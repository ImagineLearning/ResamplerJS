'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
					for (var channel = 0; channel < this.channels; ++channel) {
						outputBuffer[outputOffset++] = this.lastOutput[channel] * firstWeight + buffer[channel] * secondWeight;
					}
				}
				weight -= 1;
				for (bufferLength -= this.channels, sourceOffset = Math.floor(weight) * this.channels; sourceOffset < bufferLength;) {
					secondWeight = weight % 1;
					firstWeight = 1 - secondWeight;
					for (var _channel = 0; _channel < this.channels; ++_channel) {
						outputBuffer[outputOffset++] = buffer[sourceOffset + _channel] * firstWeight + buffer[sourceOffset + (this.channels + _channel)] * secondWeight;
					}
					weight += this.ratioWeight;
					sourceOffset = Math.floor(weight) * this.channels;
				}
				for (var _channel2 = 0; _channel2 < this.channels; ++_channel2) {
					this.lastOutput[_channel2] = buffer[sourceOffset++];
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
						for (var channel = 0; channel < this.channels; ++channel) {
							output[channel] = 0;
						}
					} else {
						weight = this.lastWeight;
						for (var _channel3 = 0; _channel3 < this.channels; ++_channel3) {
							output[_channel3] = this.lastOutput[_channel3];
						}
						alreadyProcessedTail = true;
					}
					while (weight > 0 && actualPosition < bufferLength) {
						amountToNext = 1 + actualPosition - currentPosition;
						if (weight >= amountToNext) {
							for (var _channel4 = 0; _channel4 < this.channels; ++_channel4) {
								output[_channel4] += buffer[actualPosition++] * amountToNext;
							}
							currentPosition = actualPosition;
							weight -= amountToNext;
						} else {
							for (var _channel5 = 0; _channel5 < this.channels; ++_channel5) {
								output[_channel5] += buffer[actualPosition + _channel5] * weight;
							}
							currentPosition += weight;
							weight = 0;
							break;
						}
					}
					if (weight <= 0) {
						for (var _channel6 = 0; _channel6 < this.channels; ++_channel6) {
							outputBuffer[outputOffset++] = output[_channel6] / this.ratioWeight;
						}
					} else {
						this.lastWeight = weight;
						for (var _channel7 = 0; _channel7 < this.channels; ++_channel7) {
							this.lastOutput[_channel7] = output[_channel7];
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