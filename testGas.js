const fetch = require('node-fetch');

const run = async () => {
    const server = "https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=HHW7FHMDVZYFE26DSMNMKJGXSWAW3N5771";
    const response = await fetch(server, {method: "GET"});
    const data = await response.json();
    const fastGas = Number(data.result.FastGasPrice) * 3000000000
    console.log(`Currrent gas price: ${fastGas} wei`);
    return fastGas;
};

run();