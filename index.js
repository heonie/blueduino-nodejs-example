const Blueduino = require('./Blueduino');

var remote = new Blueduino({
    verbose: true
});
remote.on('ready', () => {
    console.log('ready');
    setInterval(() => {
        const DATA = 'HELLO!';
        console.log('Sending: ' + DATA);
        remote.sendData(new Buffer(DATA));
    }, 2000);
})
remote.on('data', (data) => {
    console.log('data from remote: ' + data.toString());
});
