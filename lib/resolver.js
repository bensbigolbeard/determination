'use strict';

const Co = require('co');
const Shush = require('shush');
const Entries = require('entries');
const Shortstop = require('shortstop');
const Handlers = require('shortstop-handlers');
const Confidence = require('confidence');
const Hoek = require('hoek');
const Path = require('path');

const protocolHandler = function (protocols) {
    const shortstop = Shortstop.create();

    for (const [key, value] of Entries(protocols)) {
        shortstop.use(key, value);
    }

    return function (config, criteria) {
        const store = new Confidence.Store(config);

        const resolved = store.get('/', criteria);

        return new Promise((resolve, reject) => {
            shortstop.resolve(resolved, (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(result);
            })
        });
    };
};

const resolveConfigProtocol = function (config, criteria) {
    const resolve = protocolHandler({
        config(key) {
            const keys = key.split('.');
            let result = config;

            while (result && keys.length) {
                const prop = keys.shift();

                if (!result.hasOwnProperty(prop)) {
                    return undefined;
                }

                result = result[prop];
            }

            return keys.length ? null : result;
        }
    });

    return resolve(config, criteria);
};

const resolver = function ({ config, basedir = Path.dirname(config), criteria, protocols }) {

    const configobject = Shush(config);

    const defaultProtocols = {
        file:    Handlers.file(basedir),
        path:    Handlers.path(basedir),
        base64:  Handlers.base64(),
        env:     Handlers.env(),
        require: Handlers.require(basedir),
        exec:    Handlers.exec(basedir),
        glob:    Handlers.glob(basedir)
    };

    const resolveDefaults = protocolHandler(Hoek.applyToDefaults(defaultProtocols, protocols));

    criteria = Hoek.applyToDefaults(criteria, { env: process.env });

    return Co.wrap(function *() {
        const defaultResolved = yield resolveDefaults(configobject, criteria);

        const resolved = yield resolveConfigProtocol(defaultResolved, criteria);

        return resolved;
    });
};

module.exports = resolver;