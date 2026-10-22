// Custom gear: a camera body or a lens with every value the setting checks need. Errors show at
// the field; a server 400 shows at the top. Nothing is sent until the form is valid.

import { router } from 'expo-router';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { Text, View } from 'react-native';

import { useAddGear } from '../../../data/hooks';
import { EMPTY_FORM, LABELS, toCustomInput, type CustomGearForm, type GearErrors, type Mode } from '../../../lib/custom-gear';
import { Choice } from '../../../ui/Choice';
import { Field, Notice, PrimaryButton, Screen, TextLink } from '../../../ui/form';
import { errorText } from '../../../ui/states';

const resolver: Resolver<CustomGearForm> = async (values) => {
  const out = toCustomInput(values);
  if ('input' in out) return { values, errors: {} };
  const errors = Object.fromEntries(Object.entries(out.errors).map(([k, message]) => [k, { type: 'validate', message }]));
  return { values: {}, errors };
};

type TextField = Exclude<keyof GearErrors, 'form' | 'modes'>;
const BODY_TEXT: TextField[] = ['make', 'model', 'mount', 'slowest', 'fastest', 'isoMin', 'isoMax'];
const LENS_TEXT: TextField[] = ['make', 'model', 'mount', 'focalMin', 'focalMax', 'apertureWide', 'apertureTele', 'minAperture'];
const MODES: Mode[] = ['P', 'A', 'S', 'M'];

export default function CustomGear() {
  const add = useAddGear();
  const { control, handleSubmit, watch, setValue, formState } = useForm<CustomGearForm>({ defaultValues: EMPTY_FORM, resolver });
  const kind = watch('kind');
  const modes = watch('modes');
  const errors = formState.errors as Partial<Record<keyof GearErrors, { message?: string }>>;

  const save = handleSubmit(async (values) => {
    const out = toCustomInput(values);
    if (!('input' in out)) return;
    await add.mutateAsync({ custom: out.input }).then(() => router.back()).catch(() => undefined);
  });

  return (
    <Screen title="Custom gear">
      <TextLink title="Back" onPress={() => router.back()} />
      {add.isError ? <Notice tone="error" text={errorText(add.error)} /> : null}
      {errors.form?.message ? <Notice tone="error" text={errors.form.message} /> : null}
      <Choice label="Kind" options={[{ value: 'body', label: 'Camera body' }, { value: 'lens', label: 'Lens' }]} selected={kind} onSelect={(v) => setValue('kind', v)} />
      {kind === 'body' ? (
        <Controller control={control} name="type" render={({ field }) => (
          <Choice label="Type" options={[{ value: 'digital', label: 'Digital' }, { value: 'film', label: 'Film' }]} selected={field.value} onSelect={field.onChange} />
        )} />
      ) : null}
      {(kind === 'body' ? BODY_TEXT : LENS_TEXT).map((name) => (
        <Controller key={name} control={control} name={name} render={({ field }) => (
          <View className="gap-1">
            <Field label={LABELS[name]} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} keyboardType={['make', 'model', 'mount'].includes(name) ? 'default' : 'decimal-pad'} autoCapitalize={name === 'mount' ? 'none' : 'words'} />
            {errors[name]?.message ? <Text accessibilityLiveRegion="polite" className="text-danger">{errors[name]!.message}</Text> : null}
          </View>
        )} />
      ))}
      {kind === 'body' ? (
        <View className="gap-1">
          <Text className="font-semibold text-text">{LABELS.modes}</Text>
          <View className="flex-row gap-2">
            {MODES.map((m) => {
              const on = modes.includes(m);
              return (
                <Text
                  key={m}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => setValue('modes', on ? modes.filter((x) => x !== m) : [...modes, m])}
                  className={`min-w-11 rounded-pill border px-4 py-2 text-center ${on ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface-alt text-text'}`}
                >
                  {m}
                </Text>
              );
            })}
          </View>
          {errors.modes?.message ? <Text accessibilityLiveRegion="polite" className="text-danger">{errors.modes.message}</Text> : null}
        </View>
      ) : null}
      <PrimaryButton title="Save gear" busy={add.isPending || formState.isSubmitting} onPress={() => void save()} />
    </Screen>
  );
}
