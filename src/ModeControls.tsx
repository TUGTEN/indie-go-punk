import { useId } from 'react';
import type { Settings } from './settings';

type SliderProps = { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void };
function QuickSlider({ label, value, min, max, step = 1, unit = 'px', onChange }: SliderProps) {
  const id = useId();
  return <label className="quick-slider" htmlFor={id}>
    <span>{label}<output htmlFor={id}>{Number(value.toFixed(2))}{unit && ` ${unit}`}</output></span>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} aria-label={label} />
  </label>;
}

export function ModeControls({ values, setValue }: { values: Settings; setValue: (path: string, value: number) => void }) {
  const style = values.treatment.style;
  const sketch = values.border.style === 'Sketch';
  const grunge = values.background.texture === 'Grunge';
  if (!['Halftone', 'Dither', 'Newsprint'].includes(style) && !sketch && !grunge) return null;
  return <section className="mode-controls" aria-label="Current look controls">
    <div className="mode-controls-heading"><span className="eyebrow">TUNE THIS LOOK</span><span>Sizes refer to the exported image. All controls are also in DialKit.</span></div>
    <div className="quick-sliders">
      {style === 'Halftone' && <QuickSlider label="Halftone dot size" value={values.treatment.halftoneSize} min={1} max={24} onChange={value => setValue('treatment.halftoneSize', value)} />}
      {style === 'Dither' && <QuickSlider label="Dither pixel size" value={values.treatment.ditherPixelSize} min={1} max={16} onChange={value => setValue('treatment.ditherPixelSize', value)} />}
      {style === 'Newsprint' && <>
        <QuickSlider label="Print grain size" value={values.treatment.stippleSize} min={0.5} max={6} step={0.1} onChange={value => setValue('treatment.stippleSize', value)} />
        <QuickSlider label="Print ink density" value={values.treatment.inkDensity} min={0} max={100} unit="%" onChange={value => setValue('treatment.inkDensity', value)} />
        <QuickSlider label="Print midtone gamma" value={values.treatment.printGamma} min={0.35} max={1.5} step={0.05} unit="" onChange={value => setValue('treatment.printGamma', value)} />
        <QuickSlider label="Print screen strength" value={values.treatment.screenStrength * 100} min={0} max={100} unit="%" onChange={value => setValue('treatment.screenStrength', value / 100)} />
      </>}
      {sketch && <>
        <QuickSlider label="Sketch pen width" value={values.border.sketchStroke} min={0.5} max={20} step={0.1} onChange={value => setValue('border.sketchStroke', value)} />
        <QuickSlider label="Sketch outline gap" value={values.border.width} min={0} max={40} onChange={value => setValue('border.width', value)} />
      </>}
      {grunge && <>
        <QuickSlider label="Grunge patch size" value={values.background.patchSize} min={30} max={400} step={5} onChange={value => setValue('background.patchSize', value)} />
        <QuickSlider label="Grunge coverage" value={values.background.coverage * 100} min={0} max={100} unit="%" onChange={value => setValue('background.coverage', value / 100)} />
        <QuickSlider label="Grunge distress" value={values.background.distress * 100} min={0} max={100} unit="%" onChange={value => setValue('background.distress', value / 100)} />
        <QuickSlider label="Grunge edge bias" value={values.background.edgeBias * 100} min={0} max={100} unit="%" onChange={value => setValue('background.edgeBias', value / 100)} />
      </>}
    </div>
    {grunge && <p className="quick-hint">Generated ink patches, not tree silhouettes. Change both colors under Background → Color / Grunge Ink; Reseed gives you another composition.</p>}
  </section>;
}
