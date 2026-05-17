import type { Entry } from "../../types.js";
import EntryDetails from "../EntryDetails/index.js";

type Props = { entries: ReadonlyArray<Entry> };

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
