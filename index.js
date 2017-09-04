'use strict';

var fs = require('fs'),
    path = require('path'),
    Promise = require('bluebird'),
    util = require('util'),
    B2 = require('backblaze-b2'),
    BaseStore = require('ghost-storage-base'),
    request = Promise.promisify(require("request")),
    readFileAsync = Promise.promisify(fs.readFile);


class Store extends BaseStore {
    constructor(config) {
        super();
        var self = this;
        this.config = config;
        this.client = new B2({
            accountId: this.config.accountId,
            applicationKey: this.config.key
        });

        this.client.authorize().then((data) => {
            self.downloadUrl = data.data.downloadUrl + '/file/' + self.config.bucketName + '/';
        });

        this.targetFilename = "";
    }

    delete(fileName, targetDir) {
        return Promise.reject("Not implemented");
    }

    exists(filename, targetDir) {
        const filepath = path.join(targetDir || this.getTargetDir(), filename);
        return request(this.getUrl(filepath))
            .then(res => (res.statusCode === 200))
            .catch(() => false);
    }

    read(options) {
    }

    save(image, targetDir) {
        const directory = targetDir || this.getTargetDir(this.pathPrefix)
        var self = this;

        return new Promise((resolve, reject) => {
            Promise.all([
                readFileAsync(image.path),
                this.getUniqueFileName(image, directory)
            ])
            .then(([file, filename]) => {
                console.log("fileName: " + util.inspect(filename))
                this.file = file;
                console.log("fileName: " + util.inspect(this.file))
                this.targetFilename = filename;
                self.client.authorize().then((data) => {
                    console.log("auth success");
                    console.log("downloadUrl: " +util.inspect(self.downloadUrl));;
                    self.client.getUploadUrl(self.config.bucketId).then((obj) => {
                        console.log("uploadUrl: " +util.inspect(obj.data.uploadUrl));
                        console.log("uploadAuthToken: " +util.inspect(obj.data.authorizationToken));
                        console.log("filename: " +util.inspect(self.targetFilename));
                        self.client.uploadFile({
                            uploadUrl: obj.data.uploadUrl,
                            uploadAuthToken: obj.data.authorizationToken,
                            filename: self.targetFilename,
                            data: this.file
                        })
                        .then(() => resolve(`${self.downloadUrl}${self.targetFilename}`))
                    })
                })

            })
            .catch(error => reject(error))
        })
    }

    serve() {
        return (req, res, next) =>
        {
            next();
        }
    }

    getUrl(filename) {
        const config = this.config;
        return `${this.host}/${filename}`;
    }

}

module.exports = Store;