// Micro de la séance avec Nora : renvoie chaque bloc d'échantillons au fil de l'eau (AudioWorklet).
class EnglishMic extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('english-mic', EnglishMic);
