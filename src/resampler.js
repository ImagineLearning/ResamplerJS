//JavaScript Audio Resampler
//Copyright (C) 2011-2015 Grant Galitz
//Released to Public Domain
class Resampler {
	constructor(fromSampleRate, toSampleRate, channels, inputBuffer) {
		//Input Sample Rate:
		this.fromSampleRate = +fromSampleRate;
		//Output Sample Rate:
		this.toSampleRate = +toSampleRate;
		//Number of channels:
		this.channels = channels | 0;
		//Type checking the input buffer:
		if (typeof inputBuffer !== 'object') {
			throw new Error('inputBuffer is not an object.');
		}
		if (
			!(inputBuffer instanceof Array) &&
			!(inputBuffer instanceof Float32Array) &&
			!(inputBuffer instanceof Float64Array)
		) {
			throw new Error('inputBuffer is not an array or a float32 or a float64 array.');
		}
		this.inputBuffer = inputBuffer;
		//Initialize the resampler:
		this.initialize();
	}

	initialize() {
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

	linearInterpolation(bufferLength) {
		let outputOffset = 0;
		if (bufferLength > 0) {
			const buffer = this.inputBuffer;
			let weight = this.lastWeight;
			let firstWeight = 0;
			let secondWeight = 0;
			let sourceOffset = 0;
			let outputBuffer = this.outputBuffer;
			for (; weight < 1; weight += this.ratioWeight) {
				secondWeight = weight % 1;
				firstWeight = 1 - secondWeight;
				for (let channel = 0; channel < this.channels; ++channel) {
					outputBuffer[outputOffset++] = this.lastOutput[channel] * firstWeight + buffer[channel] * secondWeight;
				}
			}
			weight -= 1;
			for (
				bufferLength -= this.channels, sourceOffset = Math.floor(weight) * this.channels;
				sourceOffset < bufferLength;

			) {
				secondWeight = weight % 1;
				firstWeight = 1 - secondWeight;
				for (let channel = 0; channel < this.channels; ++channel) {
					outputBuffer[outputOffset++] =
						buffer[sourceOffset + channel] * firstWeight +
						buffer[sourceOffset + (this.channels + channel)] * secondWeight;
				}
				weight += this.ratioWeight;
				sourceOffset = Math.floor(weight) * this.channels;
			}
			for (let channel = 0; channel < this.channels; ++channel) {
				this.lastOutput[channel] = buffer[sourceOffset++];
			}
			this.lastWeight = weight % 1;
		}
		return outputOffset;
	}

	multiTap(bufferLength) {
		let outputOffset = 0;
		if (bufferLength > 0) {
			const buffer = this.inputBuffer;
			let weight = 0;
			let output = Array(this.channels).fill(0);
			let actualPosition = 0;
			let amountToNext = 0;
			let alreadyProcessedTail = !this.tailExists;
			this.tailExists = false;
			let outputBuffer = this.outputBuffer;
			let currentPosition = 0;
			do {
				if (alreadyProcessedTail) {
					weight = this.ratioWeight;
					for (let channel = 0; channel < this.channels; ++channel) {
						output[channel] = 0;
					}
				} else {
					weight = this.lastWeight;
					for (let channel = 0; channel < this.channels; ++channel) {
						output[channel] = this.lastOutput[channel];
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
						for (let channel = 0; channel < this.channels; ++channel) {
							output[channel] += buffer[actualPosition + channel] * weight;
						}
						currentPosition += weight;
						weight = 0;
						break;
					}
				}
				if (weight <= 0) {
					for (let channel = 0; channel < this.channels; ++channel) {
						outputBuffer[outputOffset++] = output[channel] / this.ratioWeight;
					}
				} else {
					this.lastWeight = weight;
					for (let channel = 0; channel < this.channels; ++channel) {
						this.lastOutput[channel] = output[channel];
					}
					this.tailExists = true;
					break;
				}
			} while (actualPosition < bufferLength);
		}
		return outputOffset;
	}

	bypassResampler(upTo) {
		return upTo;
	}

	initializeBuffers() {
		//Initialize the internal buffer:
		const outputBufferSize =
			Math.ceil(
				this.inputBuffer.length * this.toSampleRate / this.fromSampleRate / this.channels * 1.000000476837158203125
			) *
				this.channels +
			this.channels;
		try {
			this.outputBuffer = new Float32Array(outputBufferSize);
			this.lastOutput = new Float32Array(this.channels);
		} catch (error) {
			this.outputBuffer = [];
			this.lastOutput = [];
		}
	}
}

export default Resampler;
