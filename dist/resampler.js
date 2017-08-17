(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Resampler = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _resampler = require('./resampler');

var _resampler2 = _interopRequireDefault(_resampler);

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

exports.default = _resampler2.default;

},{"./resampler":2}],2:[function(require,module,exports){
'use strict';

var _typeof2 = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && _typeof2(Symbol.iterator) === "symbol" ? function (obj) {
	return typeof obj === "undefined" ? "undefined" : _typeof2(obj);
} : function (obj) {
	return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj === "undefined" ? "undefined" : _typeof2(obj);
};

var _createClass = function () {
	function defineProperties(target, props) {
		for (var i = 0; i < props.length; i++) {
			var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ("value" in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
		}
	}return function (Constructor, protoProps, staticProps) {
		if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
	};
}();

function _classCallCheck(instance, Constructor) {
	if (!(instance instanceof Constructor)) {
		throw new TypeError("Cannot call a class as a function");
	}
}

//JavaScript Audio Resampler
//Copyright (C) 2011-2015 Grant Galitz
//Released to Public Domain
var Resampler = function () {
	function Resampler(fromSampleRate, toSampleRate, channels, inputBuffer) {
		_classCallCheck(this, Resampler);

		//Input Sample Rate:
		this.fromSampleRate = +fromSampleRate;
		//Output Sample Rate:
		this.toSampleRate = +toSampleRate;
		//Number of channels:
		this.channels = channels | 0;
		//Type checking the input buffer:
		if ((typeof inputBuffer === 'undefined' ? 'undefined' : _typeof(inputBuffer)) !== 'object') {
			throw new Error('inputBuffer is not an object.');
		}
		if (!(inputBuffer instanceof Array) && !(inputBuffer instanceof Float32Array) && !(inputBuffer instanceof Float64Array)) {
			throw new Error('inputBuffer is not an array or a float32 or a float64 array.');
		}
		this.inputBuffer = inputBuffer;
		//Initialize the resampler:
		this.initialize();
	}

	_createClass(Resampler, [{
		key: 'initialize',
		value: function initialize() {
			//Perform some checks:
			if (this.fromSampleRate > 0 && this.toSampleRate > 0 && this.channels > 0) {
				if (this.fromSampleRate === this.toSampleRate) {
					//Setup a resampler bypass:
					this.resampler = this.bypassResampler; //Resampler just returns what was passed through.
					this.ratioWeight = 1;
					this.outputBuffer = this.inputBuffer;
				} else {
					this.ratioWeight = this.fromSampleRate / this.toSampleRate;
					if (this.fromSampleRate < this.toSampleRate) {
						/*
                         Use generic linear interpolation if upsampling,
                         as linear interpolation produces a gradient that we want
                         and works fine with two input sample points per output in this case.
                     */
						this.resampler = this.linearInterpolation.bind(this);
						this.lastWeight = 1;
					} else {
						/*
                         Custom resampler I wrote that doesn't skip samples
                         like standard linear interpolation in high downsampling.
                         This is more accurate than linear interpolation on downsampling.
                     */
						this.resampler = this.multiTap.bind(this);
						this.tailExists = false;
						this.lastWeight = 0;
					}
					this.initializeBuffers();
				}
			} else {
				throw new Error('Invalid settings specified for the resampler.');
			}
		}
	}, {
		key: 'linearInterpolation',
		value: function linearInterpolation(bufferLength) {
			var outputOffset = 0;
			if (bufferLength > 0) {
				var buffer = this.inputBuffer;
				var weight = this.lastWeight;
				var firstWeight = 0;
				var secondWeight = 0;
				var sourceOffset = 0;
				var outputBuffer = this.outputBuffer;
				for (; weight < 1; weight += this.ratioWeight) {
					secondWeight = weight % 1;
					firstWeight = 1 - secondWeight;
					for (var _channel = 0; _channel < this.channels; ++_channel) {
						outputBuffer[outputOffset++] = this.lastOutput[_channel] * firstWeight + buffer[_channel] * secondWeight;
					}
				}
				weight -= 1;
				for (bufferLength -= this.channels, sourceOffset = Math.floor(weight) * this.channels; sourceOffset < bufferLength;) {
					secondWeight = weight % 1;
					firstWeight = 1 - secondWeight;
					for (var _channel2 = 0; _channel2 < this.channels; ++_channel2) {
						outputBuffer[outputOffset++] = buffer[sourceOffset + _channel2] * firstWeight + buffer[sourceOffset + (this.channels + _channel2)] * secondWeight;
					}
					weight += this.ratioWeight;
					sourceOffset = Math.floor(weight) * this.channels;
				}
				for (var _channel3 = 0; _channel3 < this.channels; ++_channel3) {
					this.lastOutput[_channel3] = buffer[sourceOffset++];
				}
				this.lastWeight = weight % 1;
			}
			return outputOffset;
		}
	}, {
		key: 'multiTap',
		value: function multiTap(bufferLength) {
			var outputOffset = 0;
			if (bufferLength > 0) {
				var buffer = this.inputBuffer;
				var weight = 0;
				var output = Array(this.channels).fill(0);
				var actualPosition = 0;
				var amountToNext = 0;
				var alreadyProcessedTail = !this.tailExists;
				this.tailExists = false;
				var outputBuffer = this.outputBuffer;
				var currentPosition = 0;
				do {
					if (alreadyProcessedTail) {
						weight = this.ratioWeight;
						for (var _channel4 = 0; _channel4 < this.channels; ++_channel4) {
							output[_channel4] = 0;
						}
					} else {
						weight = this.lastWeight;
						for (var _channel5 = 0; _channel5 < this.channels; ++_channel5) {
							output[_channel5] = this.lastOutput[_channel5];
						}
						alreadyProcessedTail = true;
					}
					while (weight > 0 && actualPosition < bufferLength) {
						amountToNext = 1 + actualPosition - currentPosition;
						if (weight >= amountToNext) {
							for (channel = 0; channel < this.channels; ++channel) {
								output[channel] += buffer[actualPosition++] * amountToNext;
							}
							currentPosition = actualPosition;
							weight -= amountToNext;
						} else {
							for (var _channel6 = 0; _channel6 < this.channels; ++_channel6) {
								output[_channel6] += buffer[actualPosition + _channel6] * weight;
							}
							currentPosition += weight;
							weight = 0;
							break;
						}
					}
					if (weight <= 0) {
						for (var _channel7 = 0; _channel7 < this.channels; ++_channel7) {
							outputBuffer[outputOffset++] = output[_channel7] / this.ratioWeight;
						}
					} else {
						this.lastWeight = weight;
						for (var _channel8 = 0; _channel8 < this.channels; ++_channel8) {
							this.lastOutput[_channel8] = output[_channel8];
						}
						this.tailExists = true;
						break;
					}
				} while (actualPosition < bufferLength);
			}
			return outputOffset;
		}
	}, {
		key: 'bypassResampler',
		value: function bypassResampler(upTo) {
			return upTo;
		}
	}, {
		key: 'initializeBuffers',
		value: function initializeBuffers() {
			//Initialize the internal buffer:
			var outputBufferSize = Math.ceil(this.inputBuffer.length * this.toSampleRate / this.fromSampleRate / this.channels * 1.000000476837158203125) * this.channels + this.channels;
			try {
				this.outputBuffer = new Float32Array(outputBufferSize);
				this.lastOutput = new Float32Array(this.channels);
			} catch (error) {
				this.outputBuffer = [];
				this.lastOutput = [];
			}
		}
	}]);

	return Resampler;
}();

exports.default = Resampler;

},{}]},{},[1])(1)
});