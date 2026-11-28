import { describe, expect, it } from 'vitest';
import { encounterInput } from './encounterDraft';
describe('clinical notes existing API input', () => {
 it('omits empty optional notes', () => expect(encounterInput('p', 'cc', 'dx', '')).toEqual({ patientId: 'p', chiefComplaint: 'cc', diagnosis: 'dx' }));
 it('preserves whitespace, newlines and literal markup without normalization', () => { const notes = '  First\nثاني <script>literal</script>  ';expect(encounterInput('p','cc','dx',notes).notes).toBe(notes); });
 it('does not add historical editing or unrelated fields', () => expect(Object.keys(encounterInput('p','cc','dx','n'))).toEqual(['patientId','chiefComplaint','diagnosis','notes']));
});
