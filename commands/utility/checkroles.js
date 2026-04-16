const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { fetchWynncraft } = require("../../functions/apiCalls.js");
const config = require("../../config.json");
const LinkedUser = require("../../schemas/LinkedUser.js");

const RANK_TO_ROLE = {
    owner: config.roles.owner,
    chief: config.roles.chief,
    strategist: config.roles.strategist,
    captain: config.roles.captain,
    recruiter: config.roles.recruiter,
    recruit: config.roles.recruit,
};

const RANK_ROLES = [
    config.roles.recruit,
    config.roles.recruiter,
    config.roles.captain,
    config.roles.strategist,
    config.roles.chief,
    config.roles.owner,
];
const MANAGED_ROLES = [...RANK_ROLES, config.roles.guildMember, config.roles.guests, config.roles.goatGuests];

function parseGuildMembers(guildData) {
    const playerRankByUuid = {};
    for (const [rank, players] of Object.entries(guildData.members)) {
        if (rank === "total") continue;
        for (const [uuid, data] of Object.entries(players)) {
            playerRankByUuid[uuid.toLowerCase()] = { rank: rank, username: data.username };
        }
    }
    return playerRankByUuid;
}

async function fetchDatabaseUsers() {
    const dbUsers = await LinkedUser.find({});
    const dbUserMap = {};
    for (const user of dbUsers) {
        dbUserMap[user.discordId] = { uuid: user.uuid.toLowerCase(), ign: user.ign };
    }
    return dbUserMap;
}

function analyzeDiscrepancies(members, playerRankByUuid, dbUserMap) {
    const discrepancies = [];
    const actionsToTake = [];
    const dbUpdates = [];
    const dbDeletes = [];

    for (const discordId in dbUserMap) {
        if (!members.has(discordId)) {
            dbDeletes.push({ discordId: discordId, ign: dbUserMap[discordId].ign });
        }
    }

    members.forEach((member) => {
        if (member.user.bot) return;

        let uuid = null;
        let ign = null;
        let apiRank = undefined;
        let inDatabase = !!dbUserMap[member.id];

        if (inDatabase) {
            uuid = dbUserMap[member.id].uuid;
            ign = dbUserMap[member.id].ign;
        }

        if (uuid && playerRankByUuid[uuid]) {
            apiRank = playerRankByUuid[uuid].rank;
            if (inDatabase && ign !== playerRankByUuid[uuid].username) {
                dbUpdates.push({ discordId: member.id, uuid: uuid, ign: playerRankByUuid[uuid].username });
            }
        } else if (ign && inDatabase) {
            dbDeletes.push({ discordId: member.id, ign: ign });
        }

        const expectedRoles = [];
        let rolesToRemove = [];

        if (apiRank) {
            const rankRole = RANK_TO_ROLE[apiRank];
            expectedRoles.push(config.roles.guildMember, rankRole);

            rolesToRemove = member.roles.cache
                .filter(
                    (r) =>
                        r.id === config.roles.guests ||
                        r.id === config.roles.goatGuests ||
                        (RANK_ROLES.includes(r.id) && r.id !== rankRole),
                )
                .map((r) => r.id);
        } else {
            expectedRoles.push(config.roles.guests);

            rolesToRemove = member.roles.cache
                .filter((r) => r.id === config.roles.guildMember || RANK_ROLES.includes(r.id))
                .map((r) => r.id);
        }

        const rolesToAdd = expectedRoles.filter((roleId) => !member.roles.cache.has(roleId));

        if (rolesToAdd.length > 0 || rolesToRemove.length > 0) {
            const currentManagedRoles = member.roles.cache.filter((r) => MANAGED_ROLES.includes(r.id));
            const currentRolesDisplay =
                currentManagedRoles.size > 0 ? currentManagedRoles.map((r) => `<@&${r.id}>`).join(", ") : "No relevant roles.";
            const displayName = ign ? `**${ign}**` : `*Unlinked*`;
            const expectedDisplay = expectedRoles.map((id) => `<@&${id}>`).join(", ");

            discrepancies.push(`👤 ${displayName} (<@${member.id}>)\nExpected: ${expectedDisplay}\nActual: ${currentRolesDisplay}\n`);
            actionsToTake.push({ member, rolesToAdd, rolesToRemove });
        }
    });

    return { discrepancies, actionsToTake, dbUpdates, dbDeletes };
}

async function syncDatabase(dbUpdates, dbDeletes) {
    const bulkOps = [];

    for (const update of dbUpdates) {
        console.log(`[DB] Updating changed IGN: ${update.ign} (${update.discordId})`);
        bulkOps.push({
            updateOne: {
                filter: { discordId: update.discordId },
                update: { $set: { ign: update.ign, uuid: update.uuid } },
            },
        });
    }

    if (dbDeletes.length > 0) {
        const deleteIds = [];

        for (const d of dbDeletes) {
            console.log(`[DB] Removing user: ${d.ign} (${d.discordId})`);
            deleteIds.push(d.discordId);
        }

        bulkOps.push({
            deleteMany: {
                filter: { discordId: { $in: deleteIds } },
            },
        });
    }

    if (bulkOps.length > 0) {
        await LinkedUser.bulkWrite(bulkOps);
    }
}

module.exports = {
    async execute(interaction) {
        const targetGuild = await interaction.client.guilds.fetch(config.smolGuildId);
        if (!targetGuild) {
            return interaction.editReply("Could not find Discord server.");
        }

        const guildPrefix = "Sort";

        const result = await fetchWynncraft(`/guild/prefix/${guildPrefix}?identifier=uuid`);
        if (!result.success) {
            return await interaction.editReply(result.error);
        }

        const playerRankByUuid = parseGuildMembers(result.data);
        const dbUserMap = await fetchDatabaseUsers();
        const members = await targetGuild.members.fetch();

        const analysis = analyzeDiscrepancies(members, playerRankByUuid, dbUserMap);

        await syncDatabase(analysis.dbUpdates, analysis.dbDeletes);

        const embed = new EmbedBuilder()
            .setTitle(`Role sync check: ${guildPrefix}`)
            .setColor(analysis.discrepancies.length === 0 ? config.colors.success : config.colors.error)
            .setTimestamp();

        if (analysis.discrepancies.length === 0) {
            embed.setDescription(`✅ All Discord roles are synced with the Wynncraft API.`);
            return await interaction.editReply({ embeds: [embed] });
        }

        let description = `Found **${analysis.discrepancies.length}** role mismatches:\n\n`;
        let itemsShown = 0;

        for (const mismatch of analysis.discrepancies) {
            if (description.length + mismatch.length + 75 > 4096) {
                break;
            }
            description += mismatch + "\n";
            itemsShown++;
        }

        if (analysis.discrepancies.length > itemsShown) {
            description += `*...and ${analysis.discrepancies.length - itemsShown} more.*`;
        }

        embed.setDescription(description);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("sync_roles").setLabel("Sync roles now").setStyle(ButtonStyle.Primary).setEmoji("🛠️"),
        );

        const botMessage = await interaction.editReply({ embeds: [embed], components: [row] });

        try {
            const confirmation = await botMessage.awaitMessageComponent({
                filter: (i) => i.user.id === interaction.user.id,
                time: 300_000,
            });

            if (confirmation.customId === "sync_roles") {
                await confirmation.deferUpdate();

                let successCount = 0;
                let failCount = 0;

                for (const action of analysis.actionsToTake) {
                    try {
                        if (action.rolesToRemove.length > 0) {
                            await action.member.roles.remove(action.rolesToRemove);
                        }
                        if (action.rolesToAdd.length > 0) {
                            await action.member.roles.add(action.rolesToAdd);
                        }
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to sync ${action.member.user.username}:`, error);
                        failCount++;
                    }
                }

                embed.setColor(config.colors.success);
                embed.setDescription(
                    `✅ **Sync Complete!**\nSuccessfully updated **${successCount}** users.\nFailed to update: **${failCount}** users.`,
                );

                await interaction.editReply({ embeds: [embed], components: [] });
            }
        } catch (e) {
            await interaction.editReply({ components: [] });
        }
    },
};
