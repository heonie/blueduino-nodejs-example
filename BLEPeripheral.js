const async = require('async');
const noble = require('noble');
const EventEmitter = require('events');

/*
// Blueduino (using CC2540 of Texas Instruments)
const peripheralId = 'a622706c029342a0973d047cd8b735da';
const serviceUuid = 'FFF0';
const rxCharUuid = 'FFF1';  // RX(BLE beacon->Node.js) Characterastic UUID
const txCharUuid = 'FFF2';  // TX(Node.js->BLE beacon) Characterastic UUID
*/

///*
// Adafruit Blueprint LE (using nRF51822 of Nordic Semiconductors)
const peripheralId = 'c845315c2e664d2bb980bbdc6f7fc5a5';
const serviceUuid = '6e400001b5a3f393e0a9e50e24dcca9e';
const rxCharUuid = '6e400003b5a3f393e0a9e50e24dcca9e';  // RX(BLE beacon->Node.js) Characterastic UUID
const txCharUuid = '6e400002b5a3f393e0a9e50e24dcca9e';  // TX(Node.js->BLE beacon) Characterastic UUID
//*/

function log(msg) {
    console.log('['+Date.now()+'] ' + msg);
}

class BLEPeripheral extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.verbose = !!opts.verbose;
        noble.on('stateChange', (state) => {
            if (state === 'poweredOn') {
                this.verbose && log('Start Scanning');
                noble.startScanning();
            } else {
                this.txChar = this.rxChar = null;
                this.verbose && log('Stop Scanning');
                noble.stopScanning();
            }
        });
        noble.on('discover', handleDiscover.bind(this));

        function handleDiscover(peripheral) {
            var advertisement = peripheral.advertisement;
            var localName = advertisement.localName;

            this.verbose && log('Peripheral discovered: ' + peripheral.id + (localName ? (' (' + localName + ')') : ''));
            if (peripheral.id !== peripheralId) {
                return;
            }
            noble.stopScanning();
            this.verbose && log('Stop Scanning');
            this.verbose && log('peripheral ID ' + peripheralId + ' found');
            ['connect', 'disconnect'].forEach((evt) => {
                peripheral.on(evt, (...args) => {
                    this.verbose && log(evt);
                    this.emit(evt, ...args);
                });
            });
            peripheral.on('disconnect', () => {
                this.txChar = this.rxChar = null;
                this.verbose && log('Start Scanning');
                noble.startScanning();
            });

            peripheral.connect((error) => {
                if (error) {
                    this.emit('error', error);
                    this.verbose && log('error: ' + error);
                    return;
                }
                this.verbose && log('peripheral connected');

                peripheral.discoverServices([], handleDiscoverSvc.bind(this));
            });
        }

        function handleDiscoverSvc(error, services) {
            this.verbose && log(services.length + ' service(s) discovered');
            services.forEach((service) => {
                this.verbose && log('Service: ' + service);
                if(service.uuid.toUpperCase() == serviceUuid.toUpperCase()) {
                    service.discoverCharacteristics([], handleDiscoverChar.bind(this));
                }
            });
        }

        function handleDiscoverChar(error, characteristics) {
            this.verbose && log(characteristics.length + ' characteristic(s) discovered');
            characteristics.forEach((characteristic) => {
                this.verbose && log('Characteristic: ' + characteristic);
                if(characteristic.uuid.toUpperCase() === txCharUuid.toUpperCase()) {
                    this.txChar = characteristic;
                    this.verbose && log('TX characteristic found');
                }
                else if(characteristic.uuid.toUpperCase() === rxCharUuid.toUpperCase()) {
                    this.rxChar = characteristic;
                    this.verbose && log('RX characteristic found');
                    this.rxChar.on('data', (...args) => {
                        this.emit('data', ...args);
                    });
                    this.rxChar.subscribe((err) => {
                        if(err) {
                            this.emit('error', err);
                            return;
                        }
                        this.verbose && log('subscribe tx characteristic successfully');
                    });
                }
                if(this.txChar && this.rxChar) {
                    this.verbose && log('READY to communicate');
                    this.emit('ready');
                }
            });
        }
    }
    sendData (data) {
        if(!this.txChar) {
            log('not connected');
            return;
        }
        this.verbose && log('Writing : ' + data);
        this.txChar.write(data, true);
    }
}

module.exports = BLEPeripheral;
