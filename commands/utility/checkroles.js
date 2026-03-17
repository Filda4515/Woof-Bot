const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
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

module.exports = {
    async execute(interaction) {
        try {
            const response = await fetch("https://api.wynncraft.com/v3/guild/prefix/Sort?identifier=uuid");
            if (!response.ok) {
                return interaction.editReply("Failed to fetch data from Wynncraft API.");
            }
            const guildData = await response.json();

            const playerRankByUuid = {};
            for (const [rank, players] of Object.entries(guildData.members)) {
                if (rank === "total") continue;
                for (const [_uuid, _data] of Object.entries(players)) {
                    const uuid = _uuid.toLowerCase();
                    playerRankByUuid[uuid] = { rank: rank, username: _data.username };
                }
            }

            const targetGuild = await interaction.client.guilds.fetch(config.smolGuildId);
            if (!targetGuild) {
                return interaction.editReply("Could not find Discord server.");
            }

            const dbUsers = await LinkedUser.find({});
            const dbUserMap = {};
            for (const user of dbUsers) {
                dbUserMap[user.discordId] = { uuid: user.uuid.toLowerCase(), ign: user.ign };
            }

            const members = await targetGuild.members.fetch();
            const discrepancies = [];
            const actionsToTake = [];

            const dbUpserts = [];
            const dbDeletes = [];

            members.forEach((member) => {
                if (member.user.bot) return;

                let uuid = null;
                let ign = null;
                let apiRank = undefined;
                let inDatabase = false;

                if (dbUserMap[member.id]) {
                    uuid = dbUserMap[member.id].uuid;
                    ign = dbUserMap[member.id].ign;
                    inDatabase = true;
                }

                if (uuid && playerRankByUuid[uuid]) {
                    apiRank = playerRankByUuid[uuid].rank;
                    if (inDatabase && ign !== playerRankByUuid[uuid].username) {
                        dbUpserts.push({ discordId: member.id, uuid: uuid, ign: playerRankByUuid[uuid].username });
                    }
                } else if (ign) {
                    if (inDatabase) {
                        dbDeletes.push({ discordId: member.id, ign: ign });
                    }
                }

                const expectedRoles = [];
                const rolesToRemove = [];

                if (apiRank) {
                    const rankRole = RANK_TO_ROLE[apiRank];
                    expectedRoles.push(config.roles.guildMember, rankRole);
                    if (member.roles.cache.has(config.roles.guests)) rolesToRemove.push(config.roles.guests);
                    if (member.roles.cache.has(config.roles.goatGuests)) rolesToRemove.push(config.roles.goatGuests);
                    RANK_ROLES.forEach((rank) => {
                        if (rank !== rankRole && member.roles.cache.has(rank)) {
                            rolesToRemove.push(rank);
                        }
                    });
                } else {
                    expectedRoles.push(config.roles.guests);
                    if (member.roles.cache.has(config.roles.guildMember)) rolesToRemove.push(config.roles.guildMember);

                    RANK_ROLES.forEach((rank) => {
                        if (member.roles.cache.has(rank)) {
                            rolesToRemove.push(rank);
                        }
                    });
                }
                const rolesToAdd = expectedRoles.filter((roleId) => !member.roles.cache.has(roleId));

                if (rolesToAdd.length > 0 || rolesToRemove.length > 0) {
                    const currentManagedRoles = member.roles.cache.filter((r) => MANAGED_ROLES.includes(r.id));
                    const currentRolesDisplay =
                        currentManagedRoles.size > 0 ? currentManagedRoles.map((r) => `<@&${r.id}>`).join(", ") : "No relevant roles.";
                    const displayName = ign ? `**${ign}**` : `*Unlinked*`;
                    const expectedDisplay = expectedRoles.map((id) => `<@&${id}>`).join(", ");
                    discrepancies.push(
                        `👤 ${displayName} (<@${member.id}>)\nExpected: ${expectedDisplay}\nActual: ${currentRolesDisplay}\n`,
                    );
                    actionsToTake.push({
                        member: member,
                        rolesToAdd: rolesToAdd,
                        rolesToRemove: rolesToRemove,
                    });
                }
            });

            if (dbUpserts.length > 0) {
                for (const update of dbUpserts) {
                    console.log(`[DB] Upserting user: ${update.ign} (${update.discordId})`);
                    LinkedUser.findOneAndUpdate(
                        { discordId: update.discordId },
                        { ign: update.ign, uuid: update.uuid },
                        { upsert: true },
                    ).exec();
                }
            }
            if (dbDeletes.length > 0) {
                const deleteIds = dbDeletes.map((d) => d.discordId);
                dbDeletes.forEach((d) => console.log(`[DB] Removing user (left guild): ${d.ign} (${d.discordId})`));
                LinkedUser.deleteMany({ discordId: { $in: deleteIds } }).exec();
            }

            const embed = new EmbedBuilder()
                .setTitle(`Role sync check: ${guildData.name}`)
                .setColor(discrepancies.length === 0 ? config.colors.success : config.colors.error)
                .setTimestamp();

            if (discrepancies.length === 0) {
                embed.setDescription(`✅ All Discord roles are synced with the Wynncraft API.`);
                return await interaction.editReply({ embeds: [embed] });
            }

            let description = `Found **${discrepancies.length}** role mismatches:\n\n` + discrepancies.join("\n");
            if (description.length > 4096) {
                description = description.substring(0, 4090) + "...";
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

                    for (const action of actionsToTake) {
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
        } catch (error) {
            console.error("Error checking ranks:", error);
            await interaction.editReply("There was an error processing the guild data or channel messages.");
        }
    },
};
