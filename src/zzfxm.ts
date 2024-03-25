/**
 * ZzFX Music Renderer v2.0.3 by Keith Clark and Frank Force
 */

import { zzfxG, zzfxR } from './zzfx';

/**
 * @typedef Channel
 * @type {Array.<Number>}
 * @property {Number} 0 - Channel instrument
 * @property {Number} 1 - Channel panning (-1 to +1)
 * @property {Number} 2 - Note
 */
type Channel = (number | undefined)[]; //[number, number, number];

/**
 * @typedef Pattern
 * @type {Array.<Channel>}
 */
type Pattern = Channel[];

/**
 * @typedef Instrument
 * @type {Array.<Number>} ZzFX sound parameters
 */
type Instrument = (number | undefined)[];

/**
 * Generate a song
 *
 * @param instruments - Array of ZzFX sound paramaters.
 * @param patterns - Array of pattern data.
 * @param sequence - Array of pattern indexes.
 * @param [speed=125] - Playback speed of the song (in BPM).
 * @returns Left and right channel sample data.
 */
export const zzfxM = (instruments: Instrument[], patterns: Pattern[], sequence: number[], BPM = 125): number[][] => {
  let instrumentParameters: Instrument;
  let i: number;
  let j: number;
  let k: number;
  let note: number | undefined;
  let sample: number;
  let patternChannel: Channel;
  let notFirstBeat: number | undefined;
  let stop: number;
  let instrument = 0;
  let attenuation = 0;
  let outSampleOffset = 0;
  let isSequenceEnd: number;
  let sampleOffset = 0;
  let nextSampleOffset: number;
  let sampleBuffer: number[] = [];
  const leftChannelBuffer: number[] = [];
  const rightChannelBuffer: number[] = [];
  let channelIndex = 0;
  let panning = 0;
  let hasMore = 1;
  const sampleCache: Record<string, any> = {};
  const beatLength = ((zzfxR / BPM) * 60) >> 2;

  // for each channel in order until there are no more
  for (; hasMore; channelIndex++) {
    // reset current values
    sampleBuffer = [(hasMore = notFirstBeat = outSampleOffset = 0)];

    // for each pattern in sequence
    sequence.map((patternIndex, sequenceIndex) => {
      // get pattern for current channel, use empty 1 note pattern if none found
      patternChannel = patterns[patternIndex][channelIndex] || [0, 0, 0];

      // check if there are more channels
      hasMore |= !!patterns[patternIndex][channelIndex] as unknown as number;

      // get next offset, use the length of first channel
      nextSampleOffset =
        outSampleOffset + (patterns[patternIndex][0].length - 2 - (!notFirstBeat as unknown as number)) * beatLength;
      // for each beat in pattern, plus one extra if end of sequence
      isSequenceEnd = (sequenceIndex === sequence.length - 1) as unknown as number;
      for (i = 2, k = outSampleOffset; i < patternChannel.length + isSequenceEnd; notFirstBeat = ++i) {
        // <channel-note>
        note = patternChannel[i];

        // stop if end, different instrument or new note
        stop =
          (i === patternChannel.length + isSequenceEnd - 1 && isSequenceEnd) ||
          ((instrument !== (patternChannel[0] || 0)) as unknown as number) | (note as number) | 0;

        // fill buffer with samples for previous beat, most cpu intensive part
        for (
          j = 0;
          j < beatLength && notFirstBeat;
          // fade off attenuation at end of beat if stopping note, prevents clicking
          j++ > beatLength - 99 && stop && (attenuation += ((attenuation < 1) as unknown as number) / 99)
        ) {
          // copy sample to stereo buffers with panning
          sample = ((1 - attenuation) * sampleBuffer[sampleOffset++]) / 2 || 0;
          leftChannelBuffer[k] = (leftChannelBuffer[k] || 0) - sample * panning + sample;
          rightChannelBuffer[k] = (rightChannelBuffer[k++] || 0) + sample * panning + sample;
        }

        // set up for next note
        if (note) {
          // set attenuation
          attenuation = note % 1;
          panning = patternChannel[1] || 0;
          if ((note |= 0)) {
            // get cached sample
            sampleBuffer = sampleCache[`i${(instrument = patternChannel[(sampleOffset = 0)] || 0)}n${note}`] =
              sampleCache[`i${instrument}n${note}`] ||
              // add sample to cache
              ((instrumentParameters = [...instruments[instrument]]),
              // biome-ignore lint/style/noCommaOperator: <explanation>
              ((instrumentParameters[2] as number) *= 2 ** ((note - 12) / 12)),
              // allow negative values to stop notes
              note > 0 ? zzfxG(...instrumentParameters) : []);
          }
        }
      }

      // update the sample offset
      outSampleOffset = nextSampleOffset;
    });
  }

  return [leftChannelBuffer, rightChannelBuffer];
};
