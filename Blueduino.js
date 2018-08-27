const async = require('async');
const noble = require('noble');
const EventEmitter = require('events');

const peripheralId = 'a622706c029342a0973d047cd8b735da';
const serviceUuid = 'FFF0';
const rxCharUuid = 'FFF1';
const txCharUuid = 'FFF2';

function log(msg) {
    console.log(msg);
}

class Blueduino extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.verbose = !!opts.verbose;
        noble.on('stateChange', (state) => {
            if (state === 'poweredOn') {
                noble.startScanning();
            } else {
                _this.txChar = _this.rxChar = null;
                noble.stopScanning();
            }
        });
        noble.on('discover', handleDiscover);

        let _this = this;

        function handleDiscover(peripheral) {
            if (peripheral.id !== peripheralId) {
                return;
            }
            noble.stopScanning();
            _this.verbose && log('peripheral ID ' + peripheralId + ' found');
            ['connect', 'disconnect'].forEach((evt) => {
                peripheral.on(evt, (...args) => {
                    _this.emit(evt, ...args);
                });
            });
            peripheral.on('disconnect', () => {
                _this.txChar = _this.rxChar = null;
                noble.startScanning();
            });

            peripheral.connect((error) => {
                if (error) {
                    _this.emit('error', error);
                }
                _this.verbose && log('peripheral connected');

                peripheral.discoverServices([serviceUuid], (error, services) => {
                    _this.verbose && log(services.length + ' service(s) discovered');
                    services.forEach((service) => {
                        service.discoverCharacteristics([txCharUuid, rxCharUuid], (error, characteristics) => {
                            _this.verbose && log(characteristics.length + ' characteristic(s) discovered');
                            characteristics.forEach((characteristic) => {
                                _this.verbose && log('Characteristic ' + characteristic.uuid);
                                if(characteristic.uuid.toUpperCase() === txCharUuid.toUpperCase()) {
                                    _this.txChar = characteristic;
                                    _this.verbose && log('TX char found');
                                }
                                else if(characteristic.uuid.toUpperCase() === rxCharUuid.toUpperCase()) {
                                    _this.rxChar = characteristic;
                                    _this.verbose && log('RX char found');
                                    _this.rxChar.on('data', (...args) => {
                                        _this.emit('data', ...args);
                                    });
                                    _this.rxChar.subscribe((err) => {
                                        if(err) {
                                            _this.emit('error', err);
                                            return;
                                        }
                                        _this.verbose && log('subscribe tx characteristic successfully');
                                    });
                                }
                                if(_this.txChar && _this.rxChar) {
                                    _this.emit('ready');
                                }
                            });
                        });
                    });
                });
            });
        }
    }
    sendData (data) {
        if(!this.txChar) {
            log('not connected');
            return;
        }
        this.txChar.write(data, true);
    }
}

module.exports = Blueduino;
