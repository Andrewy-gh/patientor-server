import { Entry } from '../../types';
import EntryDetails from '../EntryDetails';

type Props = { entries: Entry[] };

const Entries = ({ entries }: Props) => {
  return (
    <section>
      {entries.length > 0 && <h3>Entries</h3>}
      {entries.map((entry) => (
        <EntryDetails key={entry.id} entry={entry} />
      ))}
    </section>
  );
};

export default Entries;
