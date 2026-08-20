import { VoiceAudioLayer } from "./VoiceAudioLayer";
import { VoiceCallWidget } from "./VoiceCallWidget";

export function VoiceSessionRoot() {
  return (
    <>
      <VoiceAudioLayer />
      <VoiceCallWidget />
    </>
  );
}
