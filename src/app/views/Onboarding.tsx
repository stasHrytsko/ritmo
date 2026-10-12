import { useState } from 'react';
import { ROUTINE_TEMPLATES, type RoutineTemplate } from '../../application/routineTemplates';
import { Check, MedalMark, StarRow } from '../components/icons';

const SLIDES = [
  {
    title: 'День на одной ленте',
    text: 'Рутины выстраиваются по времени, а линия «сейчас» показывает, что дальше. Отмечайте по ходу дня — одним касанием.',
    art: 'timeline'
  },
  {
    title: 'Медали вместо серий',
    text: 'Всё сделано — золото, от 70% — серебро, от половины — бронза. Пропуск не обнуляет прогресс: каждый день оценивается сам по себе.',
    art: 'medals'
  },
  {
    title: 'Карта недели',
    text: 'Раз в неделю — три закрытые карты. Выберите одну наугад: небольшое задание не про продуктивность, а про жизнь. По желанию.',
    art: 'card'
  }
] as const;

/**
 * First run: three short screens and a pick of starting routines, so the
 * first Today is never an empty page.
 */
export function Onboarding({
  onFinish
}: {
  onFinish: (templates: RoutineTemplate[]) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(['water-morning', 'walk']));
  const [busy, setBusy] = useState(false);
  const last = step === SLIDES.length;

  const finish = async (templates: RoutineTemplate[]) => {
    if (busy) return;
    setBusy(true);
    try {
      await onFinish(templates);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding app-shell" role="dialog" aria-modal="true" aria-label="Знакомство с Ritmo">
      <div className="onboarding-top">
        <span className="brand">Ritmo<span>.</span></span>
        {!last && (
          <button type="button" className="link-button onboarding-skip" onClick={() => setStep(SLIDES.length)}>
            Пропустить
          </button>
        )}
      </div>

      {!last ? (
        <div className="onboarding-slide" key={step}>
          <OnboardingArt kind={SLIDES[step].art} />
          <h1>{SLIDES[step].title}</h1>
          <p>{SLIDES[step].text}</p>
        </div>
      ) : (
        <div className="onboarding-slide" key="pick">
          <h1>С чего начнём?</h1>
          <p>Отметьте пару рутин — их всегда можно изменить или удалить в разделе «Жизнь».</p>
          <div className="template-list">
            {ROUTINE_TEMPLATES.map((template) => {
              const on = picked.has(template.id);
              return (
                <button
                  type="button"
                  key={template.id}
                  className={`template-row${on ? ' on' : ''}`}
                  aria-pressed={on}
                  onClick={() => setPicked((current) => {
                    const next = new Set(current);
                    if (on) next.delete(template.id);
                    else next.add(template.id);
                    return next;
                  })}
                >
                  <span><strong>{template.name}</strong><small>{template.hint}</small></span>
                  <i className="task-check"><Check /></i>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="onboarding-bottom">
        {!last && (
          <div className="onboarding-dots" aria-hidden="true">
            {SLIDES.map((slide, index) => <i key={slide.title} className={index === step ? 'on' : ''} />)}
          </div>
        )}
        {last ? (
          <>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={() => void finish(ROUTINE_TEMPLATES.filter((template) => picked.has(template.id)))}
            >
              {picked.size > 0 ? `Начать с ${picked.size} ${pluralRoutines(picked.size)}` : 'Начать с чистого листа'}
            </button>
          </>
        ) : (
          <button type="button" className="primary" onClick={() => setStep((current) => current + 1)}>
            Дальше
          </button>
        )}
      </div>
    </div>
  );
}

function pluralRoutines(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'рутины';
  return 'рутин';
}

function OnboardingArt({ kind }: { kind: (typeof SLIDES)[number]['art'] }) {
  if (kind === 'medals') {
    return (
      <div className="onboarding-art medals" aria-hidden="true">
        <MedalMark tier="bronze" />
        <MedalMark tier="gold" />
        <MedalMark tier="silver" />
      </div>
    );
  }
  if (kind === 'card') {
    return (
      <div className="onboarding-art cards" aria-hidden="true">
        <span className="card-back"><StarRow tier="easy" /></span>
        <span className="card-back"><StarRow tier="medium" /></span>
        <span className="card-back"><StarRow tier="hard" /></span>
      </div>
    );
  }
  return (
    <div className="onboarding-art timeline" aria-hidden="true">
      <span><b>07:30</b><i className="done" />Стакан воды</span>
      <span className="now"><b>12:40</b><em /></span>
      <span><b>21:30</b><i />Чтение</span>
    </div>
  );
}
