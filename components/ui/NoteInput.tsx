import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';

import { makeStyles, noOutline, useTheme } from '@/constants/theme';

/** A quiet multi-line field, saved when you leave it. */
export default function NoteInput({ value, placeholder, onSave }: { value?: string; placeholder: string; onSave: (text: string) => void }) {
  const { palette } = useTheme();
  const styles = useStyles();
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const save = () => {
    if (draft.trim() !== (value ?? '')) onSave(draft);
  };
  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={save}
      onEndEditing={save}
      placeholder={placeholder}
      placeholderTextColor={palette.inkFaint}
      multiline
      textAlignVertical="top"
      style={[styles.note, noOutline]}
    />
  );
}

const useStyles = makeStyles(({ palette, fonts }) => ({
  note: { minHeight: 64, borderRadius: 12, padding: 12, backgroundColor: palette.field, ...fonts.displayItalic, fontSize: 17, lineHeight: 22, color: palette.ink },
}));
