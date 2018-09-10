const assert = require('chai').assert

const test = require('./helpers/test');

describe('SERVER', () => {
    describe('Constructor', () => {
        it('should contain a Saito app instance', () => {});
        it('should have a string blocks_dir value', () => {});
        it('should have object server field', () => {});
        it('server object should have host, port, publickey, and protcol', () => {});
        it('server object should have endpoint object with host, port, and protocol fields', () => {});
        it('should have webserver field', () => {});
        it('should have io field', () => {});
    });
    describe('initialize', () => {
        it('should early return if app.BROWSER equals 1', () => {});
        it('should update server information from options file', () => {});
        it('should early return if host and port are not in the options file', () => {});
        it('should update endpoint information from options file', () => {});
        it('should update endpoint field in options file with server field if endpoint is null', () => {});
        it('should start express server', () => {});

        // investigate testing HTTP calls
        it('should serve blocks from mempool at /blocks if they exist in memory', () => {});
        it('should return the block file requested at /blocks if it does not exist in memory', () => {});
        it('should return index.html at root route', () => {});
        it('should return browser.js at /browser.js route', () => {});

        it('should call modules.webServer(app)', () => {});
    });
    describe('close', () => {
        it('should call webserver.close()', () => {});
    });
});
