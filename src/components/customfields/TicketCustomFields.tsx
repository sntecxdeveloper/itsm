import { useEffect, useMemo, useState } from 'react';
import { getFormFields, isFilled, saveTicketFields, type CustomFieldDef } from '../../api/customFieldApi';
import { toast } from '../common/Toast';
import { getErrorMessage } from '../../utils/errorHandler';
import CustomFieldsForm from './CustomFieldsForm';
import type { ItsmTicket } from '../../types/itsm';

interface Props {
  ticket: ItsmTicket;
  onSaved: (ticket: ItsmTicket) => void;
}

/** The custom fields of an existing ticket, editable, saved to the server. Shows nothing when no field applies. */
export default function TicketCustomFields({ ticket, onSaved }: Props) {
  const [fields, setFields] = useState<CustomFieldDef[] | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>(ticket.customValues ?? {});
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    getFormFields(ticket.category ?? undefined)
      .then(setFields)
      .catch(() => setFields([]));
  }, [ticket.category]);

  useEffect(() => {
    setValues(ticket.customValues ?? {});
  }, [ticket.customValues]);

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(ticket.customValues ?? {}), [values, ticket.customValues]);

  if (!fields || fields.length === 0) return null;

  const save = async () => {
    const empty = fields.filter((f) => f.required && !isFilled(values[f.key])).map((f) => f.key);
    setMissing(empty);
    if (empty.length > 0) return;
    setBusy(true);
    try {
      const sent: Record<string, unknown> = {};
      fields.forEach((f) => (sent[f.key] = values[f.key] ?? null));
      onSaved(await saveTicketFields(ticket.id, sent));
      toast('Fields saved', 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-2 border-t border-slate-300 px-3 pt-3" aria-label="More fields">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-slate-700">More details</h2>
        <button type="button" disabled={!dirty || busy} onClick={() => void save()} className="rounded bg-primary-600 px-3 py-1 text-[12px] font-medium text-white hover:bg-primary-700 disabled:opacity-40">
          {busy ? 'Saving…' : 'Save fields'}
        </button>
      </div>
      <CustomFieldsForm fields={fields} values={values} missing={missing} onChange={(k, v) => setValues((cur) => ({ ...cur, [k]: v }))} />
    </section>
  );
}
