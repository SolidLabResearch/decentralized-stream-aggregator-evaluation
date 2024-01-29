"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.find_aggregator_location = exports.add_event_to_rsp_engine = exports.epoch = exports.record_usage = exports.insertion_sort = exports.record = void 0;
var pidusage_1 = require("pidusage");
var fs = require("fs");
var ldfetch = require('ldfetch');
var N3 = require('n3');
var fetch = new ldfetch({});
function record(evaluation_name, query_function_id) {
    return __awaiter(this, void 0, void 0, function () {
        var process_id, memory_usage, memory_mb;
        return __generator(this, function (_a) {
            process_id = process.pid;
            memory_usage = (process.memoryUsage());
            memory_mb = memory_usage.rss / 1024 / 1024;
            pidusage_1["default"](process_id, function (err, stats) {
                var timestamp = stats.timestamp;
                var cpu_usage = stats.cpu.toFixed(3);
                var timestamp_date = new Date(timestamp).toISOString().replace(/T/, ' ').replace(/\..+/, '');
                var data = timestamp + "," + cpu_usage + "," + memory_mb.toFixed(3) + "\n";
                // const file = `${evaluation_name}/${query_function_id}.csv`;
                var file = query_function_id + ".csv";
                fs.appendFile(file, data, function () {
                });
            });
            return [2 /*return*/];
        });
    });
}
exports.record = record;
function insertion_sort(arr) {
    var len = arr.length;
    for (var i = 1; i < len; i++) {
        var current = arr[i];
        var j = i - 1;
        while (j >= 0 && arr[j] > current) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = current;
    }
    return arr;
}
exports.insertion_sort = insertion_sort;
function record_usage(evaluation_name, query_function_id, interval) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            setInterval(function () {
                record(evaluation_name, query_function_id);
            }, interval);
            return [2 /*return*/];
        });
    });
}
exports.record_usage = record_usage;
function epoch(date) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, Date.parse(date)];
        });
    });
}
exports.epoch = epoch;
function add_event_to_rsp_engine(store, stream_name, timestamp) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            stream_name.forEach(function (stream) {
                var quads = store.getQuads(null, null, null, null);
                for (var _i = 0, quads_1 = quads; _i < quads_1.length; _i++) {
                    var quad = quads_1[_i];
                    console.log(typeof stream);
                    stream.add(quad, timestamp);
                }
            });
            return [2 /*return*/];
        });
    });
}
exports.add_event_to_rsp_engine = add_event_to_rsp_engine;
function find_aggregator_location(solid_pod_webid) {
    return __awaiter(this, void 0, void 0, function () {
        var pod_location;
        return __generator(this, function (_a) {
            pod_location = solid_pod_webid.split('/profile/card#me')[0] + '/';
            fetch.get(solid_pod_webid).then(function (response) {
                var profile_store = new N3.Store(response.triples);
                for (var _i = 0, profile_store_1 = profile_store; _i < profile_store_1.length; _i++) {
                    var quad = profile_store_1[_i];
                    if (quad.predicate.value === 'http://argahsuknesib.github.io/asdo/hasAggregatorLocation') {
                        var aggregator_ws = quad.object.value;
                        var aggregator_ws_location = 'ws://' + aggregator_ws[1].split('//');
                        return aggregator_ws_location;
                    }
                }
            });
            return [2 /*return*/];
        });
    });
}
exports.find_aggregator_location = find_aggregator_location;
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var web_id;
        return __generator(this, function (_a) {
            web_id = 'http://localhost:3000/dataset_participant1/profile/card#me';
            find_aggregator_location(web_id);
            return [2 /*return*/];
        });
    });
}
main();
