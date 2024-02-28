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
var rsp_js_1 = require("rsp-js");
var FileStreamer_1 = require("./FileStreamer");
var fs = require("fs");
var versionawareldesinldp_1 = require("@treecg/versionawareldesinldp");
var ldes_location = "http://n061-14a.wall2.ilabt.iminds.be:3000/participant6/skt/";
var query = "\n    PREFIX saref: <https://saref.etsi.org/core/>\n    PREFIX dahccsensors: <https://dahcc.idlab.ugent.be/Homelab/SensorsAndActuators/>\n    PREFIX : <https://rsp.js/>\n    REGISTER RStream <output> AS\n    SELECT (AVG(?o) as ?maxSKT)\n    FROM NAMED WINDOW :w1 ON STREAM <" + ldes_location + "> [RANGE 300000 STEP 60000]\n    WHERE {\n        WINDOW :w1 {\n            ?s saref:hasValue ?o .\n            ?s saref:relatesToProperty dahccsensors:wearable.skt .\n        }   \n    }\n";
var number_of_iterations = 33;
var to_date = new Date("2024-02-01T17:54:03.025Z");
var from_date = new Date("2024-02-01T17:49:03.012Z");
function rsp_engine() {
    return __awaiter(this, void 0, void 0, function () {
        var rsp_engine, parser, rsp_emitter, stream_array, parsed_query, _i, stream_array_1, stream, file_streamer, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rsp_engine = new rsp_js_1.RSPEngine(query);
                    parser = new rsp_js_1.RSPQLParser();
                    rsp_emitter = rsp_engine.register();
                    stream_array = [];
                    parsed_query = parser.parse(query);
                    parsed_query.s2r.forEach(function (stream) {
                        stream_array.push(stream.stream_name);
                    });
                    _i = 0, stream_array_1 = stream_array;
                    _a.label = 1;
                case 1:
                    if (!(_i < stream_array_1.length)) return [3 /*break*/, 7];
                    stream = stream_array_1[_i];
                    file_streamer = new FileStreamer_1.FileStreamer(stream, from_date, to_date, rsp_engine, parsed_query.s2r[0].width);
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < number_of_iterations)) return [3 /*break*/, 6];
                    file_streamer.initialize_file_streamer();
                    return [4 /*yield*/, subscribe_to_results(rsp_emitter, i)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, versionawareldesinldp_1.sleep(10000)];
                case 4:
                    _a.sent();
                    reset_state(rsp_emitter, rsp_engine);
                    _a.label = 5;
                case 5:
                    i++;
                    return [3 /*break*/, 2];
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function reset_state(emitter, rsp_engine) {
    emitter.removeAllListeners('RStream');
    emitter.removeAllListeners('end');
    rsp_engine.windows[0].active_windows = new Map();
    rsp_engine.windows[0].t0 = 0;
    rsp_engine.windows[0].time = 0;
}
function subscribe_to_results(rsp_emitter, i) {
    return __awaiter(this, void 0, void 0, function () {
        var listener;
        return __generator(this, function (_a) {
            listener = function (event) {
                var iterable = event.bindings.values();
                for (var _i = 0, iterable_1 = iterable; _i < iterable_1.length; _i++) {
                    var item = iterable_1[_i];
                    console.log(item);
                    if (item.value !== 0) {
                        fs.appendFileSync("output.txt", item.value + "\n");
                    }
                }
            };
            rsp_emitter.on('RStream', listener);
            rsp_emitter.on('end', function () {
                rsp_emitter.removeListener('RStream', listener);
            });
            return [2 /*return*/];
        });
    });
}
rsp_engine();
