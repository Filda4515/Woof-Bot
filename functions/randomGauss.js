function randomGauss(mean = 50, stdDev = 20, min = 1, max = 100) {
    let number;

    do {
        let u1 = 0;
        let u2 = 0;
        while (u1 === 0) u1 = Math.random();
        while (u2 === 0) u2 = Math.random();

        let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        number = z0 * stdDev + mean;
    } while (number < min || number > max);

    return Math.round(number * 100) / 100;
}

module.exports = { randomGauss };