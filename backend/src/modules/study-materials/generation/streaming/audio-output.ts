const MAX_GENERATED_AUDIO_BYTES = 64 * 1024 * 1024;
const MAX_GENERATED_AUDIO_SECONDS = 13 * 60;

export function stripCitationMarkers(text: string): string {
  return text
    .replace(/\[ref:[^\]]+\]/gi, '')
    .replace(/#reference-\d+/gi, '')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

export function assertGeneratedWav(audio: Buffer): void {
  if (
    audio.length < 12 ||
    audio.length > MAX_GENERATED_AUDIO_BYTES ||
    audio.toString('ascii', 0, 4) !== 'RIFF' ||
    audio.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error(
      'Speech synthesis returned an invalid or oversized WAV file.',
    );
  }
  let byteRate = 0;
  let dataLength = 0;
  for (let offset = 12; offset + 8 <= audio.length;) {
    const chunkId = audio.toString('ascii', offset, offset + 4);
    const chunkLength = audio.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkLength > audio.length - chunkStart) break;
    if (chunkId === 'fmt ' && chunkLength >= 16) {
      byteRate = audio.readUInt32LE(chunkStart + 8);
    } else if (chunkId === 'data') {
      dataLength = chunkLength;
    }
    offset = chunkStart + chunkLength + (chunkLength % 2);
  }
  if (
    byteRate === 0 ||
    dataLength === 0 ||
    dataLength / byteRate > MAX_GENERATED_AUDIO_SECONDS
  ) {
    throw new Error(
      'Speech synthesis returned a WAV with invalid duration metadata.',
    );
  }
}
