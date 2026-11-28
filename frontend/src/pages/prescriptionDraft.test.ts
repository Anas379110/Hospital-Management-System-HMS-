import { expect, it } from 'vitest';
import { prescriptionInput } from './prescriptionDraft';
it('omits empty optional notes', () => { expect(prescriptionInput('e','m','d','t','')).toEqual({ encounterId:'e',medicationName:'m',dosage:'d',duration:'t' }); });
it.each(['  fictional  ', 'Fictional line1\nملاحظة وهمية <script>not code</script>'])('preserves exact nonempty notes', notes => { expect(prescriptionInput('e','m','d','t',notes).notes).toBe(notes); });
