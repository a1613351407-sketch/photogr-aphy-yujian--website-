'use client';
import {sendForm} from '@/lib/send-form';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Aperture,
  LockKeyhole,
  ImagePlus,
  X,
  Upload,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { STYLES, OPTIONS, emptyAnswers, type Answers } from '@/lib/options';
import { MAX_FILE, MAX_TOTAL } from '@/lib/validation';

type UploadItem = { file: File; url: string; id: string };
function Choice({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="question-block">
      <legend>{title}</legend>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(String(v))}
        className="choice-row"
        aria-label={title}
      >
        {options.map((o) => (
          <label
            className={'choice ' + (value === o ? 'is-checked' : '')}
            key={o}
          >
            <RadioGroupItem value={o} />
            {o}
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
export default function Home() {
  const [answers, setAnswers] = useState<Answers>(emptyAnswers);
  const [step, setStep] = useState('0');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const [visited, setVisited] = useState<string[]>(['0']);
  const liveUploads = useRef<UploadItem[]>([]);
  useEffect(() => {
    liveUploads.current = uploads;
  }, [uploads]);
  useEffect(
    () => () => {
      liveUploads.current.forEach((u) => URL.revokeObjectURL(u.url));
    },
    [],
  );
  const update = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setAnswers((a) => ({ ...a, [key]: value }));
  const chooseStyle = (id: string) => {
    setAnswers((a) => ({
      ...a,
      undecided: false,
      customStyle: '',
      styles: [id],
    }));
    window.setTimeout(() => changeStep('1'), 180);
  };
  const preferenceKeys = [
    'purpose',
    'location',
    'retouch',
    'makeup',
  ] as const;
  function choosePreference(key: (typeof preferenceKeys)[number], value: string) {
    update(key, value);
    const complete = preferenceKeys.every((candidate) =>
      candidate === key ? value : answers[candidate],
    );
    if (complete) window.setTimeout(() => changeStep('2'), 180);
  }
  function changeStep(value: string) {
    if (busy || value === step) return;
    setStep(value);
    setVisited((current) =>
      current.includes(value) ? current : [...current, value],
    );
    setError('');
    requestAnimationFrame(() => {
      stepHeading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }
  function next() {
    if (
      step === '0' &&
      !answers.styles.length &&
      !answers.undecided &&
      !answers.customStyle.trim()
    ) {
      setError('请选择喜欢的风格，或勾选「还没确定，请摄影师建议」。');
      return;
    }
    if (
      step === '1' &&
      preferenceKeys.some((key) => !answers[key])
    ) {
      setError('请完成四项拍摄偏好。');
      return;
    }
    changeStep(String(Number(step) + 1));
  }
  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    setError('');
    if (uploads.length + incoming.length > 6) {
      setError('最多可以上传 6 张参考照片。');
      return;
    }
    if (
      incoming.some(
        (f) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ||
          !f.size ||
          f.size > MAX_FILE,
      )
    ) {
      setError('请选择 JPG、PNG 或 WebP 图片，每张不超过 5MB。');
      return;
    }
    if (
      [...uploads.map((u) => u.file), ...incoming].reduce(
        (n, f) => n + f.size,
        0,
      ) > MAX_TOTAL
    ) {
      setError('参考照片总大小不能超过 12MB，请移除一些照片后重试。');
      return;
    }
    setUploads((u) => [
      ...u,
      ...incoming.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        id: crypto.randomUUID(),
      })),
    ]);
    window.setTimeout(() => changeStep('3'), 180);
  }
  function removeUpload(id: string) {
    setUploads((current) =>
      current.filter((u) => {
        if (u.id === id) {
          URL.revokeObjectURL(u.url);
          return false;
        }
        return true;
      }),
    );
  }
  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (
      !answers.styles.length &&
      !answers.undecided &&
      !answers.customStyle.trim()
    ) {
      changeStep('0');
      setError('请先选择风格，或选择一起商量。');
      return;
    }
    if (!answers.consent) {
      setError('请先同意将问卷与参考照片用于拍摄沟通。');
      return;
    }
    setBusy(true);
    try {
      const data = new FormData();
      data.append('answers', JSON.stringify(answers));
      uploads.forEach((u) => data.append('photos', u.file));
      const response = await sendForm('/api/surveys', {
        method: 'POST',
        body: data,
      });
      if (response.status === 413)
        throw new Error('图片总大小超过限制，请减少图片后重试。');
      if (!response.headers.get('Content-Type')?.includes('application/json'))
        throw new Error('服务暂时无法连接，请稍后重试。');
      const result = (await response.json()) as {
        error?: string;
        reference: string;
      };
      if (!response.ok)
        throw new Error(result.error || '暂时无法提交，请重试。');
      setSuccess(result.reference);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : '网络连接失败，请重试。');
    } finally {
      setBusy(false);
    }
  }
  const summaryStyles = [
    ...STYLES.filter((s) => answers.styles.includes(s.id)).map((s) => s.name),
    ...(answers.customStyle ? [answers.customStyle] : []),
    ...(answers.undecided ? ['一起商量'] : []),
  ].join('、');
  const steps = ['风格意向', '拍摄偏好', '参考照片', '确认提交'];
  const titles = [
    '您喜欢哪些风格、哪些照片？',
    '您想在哪里拍？有什么拍摄要求？',
    '有想拍的参考照片吗？',
    '怎么称呼您？如何联系您？',
  ];
  const descriptions = [
    '点击照片选择，只能选一种。选择后自动进入下一步。',
    '完成四项拍摄偏好后自动进入下一步。日期与预算可以稍后商量。',
    '选择照片后自动进入下一步，也可以不上传、直接跳过。',
    '留下联系方式，再检查一遍资料，最后提交给摄影师。',
  ];
  return (
    <div className="client-questionnaire">
      <header className="site-header">
        <a className="brand" href="/">
          <Aperture size={26} />
          <span className="brand-name">
            玉鉴<small>PHOTO STUDIO</small>
          </span>
        </a>
        <nav>
          <a href="/studio">
            摄影师工作台 <ArrowUpRight size={14} />
          </a>
        </nav>
      </header>
      {success ? (
        <main className="success-page">
          <div className="success-symbol">
            <CheckCircle2 size={38} />
          </div>
          <h1>问卷已提交</h1>
          <p>
            您的资料和 {uploads.length} 张参考照片已保存。
            <br />
            摄影师会通过您留下的联系方式，与您确认拍摄安排。
          </p>
          <div className="success-details">
            <span>问卷编号</span>
            <strong>{success}</strong>
            <span>喜欢的风格</span>
            <strong>{summaryStyles}</strong>
            <span>联系方式</span>
            <strong>{answers.contact}</strong>
          </div>
          <p className="fine-print">
            提交问卷不代表预约成功，拍摄时间和费用还需双方确认。
          </p>
          <a href="/" className="secondary-btn">
            填写新问卷 <ArrowUpRight size={16} />
          </a>
        </main>
      ) : (
        <main className="questionnaire">
          <div className="questionnaire-caption">
            <span>拍摄前问卷</span>
            <span>共 4 步 · 可返回修改</span>
          </div>
          <nav className="questionnaire-progress" aria-label="问卷填写步骤">
            <ol>
              {steps.map((label, i) => (
                <li key={label}>
                  <button
                    type="button"
                    aria-current={step === String(i) ? 'step' : undefined}
                    disabled={
                      busy || (!visited.includes(String(i)) && i > Number(step))
                    }
                    onClick={() => changeStep(String(i))}
                  >
                    <span className="progress-number">{i + 1}</span>
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <section
            className="questionnaire-section"
            aria-labelledby="step-heading"
          >
            <header className="question-heading">
              <p>
                第 {Number(step) + 1} 步 / {steps[Number(step)]}
              </p>
              <h1 id="step-heading" ref={stepHeading} tabIndex={-1}>
                {titles[Number(step)]}
              </h1>
              <p>{descriptions[Number(step)]}</p>
            </header>
            {step === '0' && (
              <>
                <RadioGroup
                  className="style-grid"
                  value={answers.styles[0] || ''}
                  onValueChange={(value) => chooseStyle(String(value))}
                  aria-label="选择一种拍摄风格"
                >
                  {STYLES.map((s) => (
                    <label
                      className={
                        'style-card ' +
                        (answers.styles.includes(s.id) ? 'selected' : '')
                      }
                      key={s.id}
                    >
                      <div className="portrait">
                        <img
                          src={s.image}
                          width={1024}
                          height={1536}
                          alt={s.name + '风格参考照片'}
                        />
                        <span className="ai-label">AI 示例</span>
                        <RadioGroupItem
                          className="portrait-check"
                          value={s.id}
                          aria-label={'选择' + s.name}
                        />
                      </div>
                      <div className="style-caption">
                        <h2>{s.name}</h2>
                        <span>
                          {answers.styles.includes(s.id)
                            ? '已选择'
                            : '点击选择'}
                        </span>
                      </div>
                      <p className="style-tags">{s.tags}</p>
                    </label>
                  ))}
                </RadioGroup>
                <div className="image-disclaimer">
                  <span>以上照片为 AI 生成的风格示例。</span>
                  <span aria-live="polite">
                    {answers.styles.length
                      ? `已选择：${STYLES.find((style) => style.id === answers.styles[0])?.name}`
                      : '请选择 1 种风格'}
                  </span>
                </div>
                <div className="extra-style">
                  <label className="custom-style">
                    其他喜欢的风格（选填）
                    <input
                      value={answers.customStyle}
                      maxLength={200}
                      onChange={(e) =>
                        setAnswers((current) => ({
                          ...current,
                          styles: [],
                          undecided: false,
                          customStyle: e.target.value,
                        }))
                      }
                      onBlur={() => {
                        if (answers.customStyle.trim()) changeStep('1');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && answers.customStyle.trim()) {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                      placeholder="例如：复古胶片、港风、黑白照片"
                    />
                  </label>
                  <label className="checkbox-line" htmlFor="undecided-style">
                    <Checkbox
                      id="undecided-style"
                      checked={answers.undecided}
                      onCheckedChange={(v) => {
                        setAnswers((a) => ({
                          ...a,
                          undecided: v,
                          styles: v ? [] : a.styles,
                          customStyle: v ? '' : a.customStyle,
                        }))
                        if (v) window.setTimeout(() => changeStep('1'), 180);
                      }}
                    />
                    还没确定，请摄影师建议
                  </label>
                </div>
              </>
            )}
            {step === '1' && (
              <div className="form-panel">
                <Choice
                  title="这次想拍什么？"
                  options={OPTIONS.purpose}
                  value={answers.purpose}
                  onChange={(v) => choosePreference('purpose', v)}
                />
                <Choice
                  title="您喜欢在哪里拍？"
                  options={OPTIONS.location}
                  value={answers.location}
                  onChange={(v) => choosePreference('location', v)}
                />
                <Choice
                  title="您希望怎么修图？"
                  options={OPTIONS.retouch}
                  value={answers.retouch}
                  onChange={(v) => choosePreference('retouch', v)}
                />
                <div className="field-pair">
                  <label className="field">
                    想在哪天拍？<span>选填</span>
                    <input
                      type="date"
                      value={answers.date}
                      onChange={(e) => update('date', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    大致预算是多少？<span>选填</span>
                    <input
                      value={answers.budget}
                      maxLength={100}
                      placeholder="例如：100～300 元，或一起商量"
                      onChange={(e) => update('budget', e.target.value)}
                    />
                  </label>
                </div>
                <label className="field">
                  还有什么需要摄影师注意？<span>选填</span>
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={answers.notes}
                    onChange={(e) => update('notes', e.target.value)}
                    placeholder="例如：不太会摆姿势、不喜欢的拍摄角度、需要避开的造型"
                  />
                </label>
                <Choice
                  title="化妆和服装需要帮忙安排吗？"
                  options={OPTIONS.makeup}
                  value={answers.makeup}
                  onChange={(v) => choosePreference('makeup', v)}
                />
              </div>
            )}
            {step === '2' && (
              <div className="form-panel">
                <div
                  className={'upload-zone ' + (dragging ? 'dragging' : '')}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    addFiles(e.dataTransfer.files);
                  }}
                >
                  <div className="upload-icon">
                    <Upload size={25} />
                  </div>
                  <h2>上传您喜欢的照片</h2>
                  <p>从相册或电脑选择，也可以拖到这里。</p>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => fileInput.current?.click()}
                  >
                    <ImagePlus size={17} />
                    选择参考照片
                  </button>
                  <span>
                    JPG / PNG / WebP · 最多 6 张<br />
                    单张不超过 5MB，合计不超过 12MB
                  </span>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden-file-input"
                    tabIndex={-1}
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = '';
                    }}
                    aria-label="上传参考照片"
                  />
                </div>
                {uploads.length > 0 && (
                  <>
                    <output className="upload-count">
                      已添加 {uploads.length} 张照片
                    </output>
                    <div className="upload-grid">
                      {uploads.map((u) => (
                        <div className="upload-item" key={u.id}>
                          <img src={u.url} alt={u.file.name} />
                          <button
                            type="button"
                            onClick={() => removeUpload(u.id)}
                            aria-label={'移除 ' + u.file.name}
                          >
                            <X size={16} />
                          </button>
                          <p title={u.file.name}>{u.file.name}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <label className="field reference-field">
                  您喜欢这些照片的哪些地方？<span>选填</span>
                  <textarea
                    rows={3}
                    value={answers.referenceNotes}
                    maxLength={1500}
                    onChange={(e) => update('referenceNotes', e.target.value)}
                    placeholder="例如：第一张的光线、第二张的姿势，或照片里的衣服和颜色"
                  />
                </label>
                <p className="reference-privacy">
                  <LockKeyhole size={16} />
                  照片仅用于拍摄沟通，不会公开展示或用于 AI 训练。
                </p>
              </div>
            )}
            {step === '3' && (
              <form ref={formRef} onSubmit={submit} id="submit-survey">
                <div className="form-panel">
                  <div className="field-pair">
                    <label className="field">
                      您的称呼<span className="required">必填</span>
                      <input
                        required
                        autoComplete="name"
                        maxLength={60}
                        value={answers.name}
                        onChange={(e) => update('name', e.target.value)}
                        placeholder="姓名或昵称"
                        disabled={busy}
                      />
                    </label>
                    <label className="field">
                      手机号 / 微信 / 邮箱<span className="required">必填</span>
                      <input
                        required
                        minLength={3}
                        maxLength={120}
                        value={answers.contact}
                        onChange={(e) => update('contact', e.target.value)}
                        placeholder="填写一种方便联系您的方式"
                        disabled={busy}
                      />
                    </label>
                  </div>
                  <section
                    className="review-sheet"
                    aria-labelledby="review-heading"
                  >
                    <div className="review-title">
                      <h2 id="review-heading">核对您的拍摄需求</h2>
                    </div>
                    <div className="review-row">
                      <span>喜欢的风格</span>
                      <strong>{summaryStyles || '未选择'}</strong>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => changeStep('0')}
                      >
                        修改
                      </button>
                    </div>
                    <div className="review-row">
                      <span>拍摄用途</span>
                      <strong>{answers.purpose}</strong>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => changeStep('1')}
                      >
                        修改
                      </button>
                    </div>
                    {Object.entries({
                      拍摄地点: answers.location,
                      修图要求: answers.retouch,
                      化妆与服装: answers.makeup,
                      拍摄日期: answers.date || '待商量',
                      大致预算: answers.budget || '待商量',
                    }).map(([label, value]) => (
                      <div className="review-row" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                    <div className="review-row">
                      <span>参考照片</span>
                      <strong>{uploads.length} 张</strong>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => changeStep('2')}
                      >
                        修改
                      </button>
                    </div>
                    {answers.notes && (
                      <div className="review-row">
                        <span>其他要求</span>
                        <strong>{answers.notes}</strong>
                      </div>
                    )}
                    {answers.referenceNotes && (
                      <div className="review-row">
                        <span>照片说明</span>
                        <strong>{answers.referenceNotes}</strong>
                      </div>
                    )}
                  </section>
                  <div hidden aria-hidden="true">
                    <label>
                      网站
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        value={answers.website}
                        onChange={(e) => update('website', e.target.value)}
                      />
                    </label>
                  </div>
                </div>
                <section
                  className="submit-section"
                  aria-labelledby="submit-heading"
                >
                  <h2 id="submit-heading">确认无误后，提交给摄影师</h2>
                  <p>
                    提交后，摄影师会联系您。拍摄日期和费用以双方确认的结果为准。
                  </p>
                  <label className="checkbox-line consent" htmlFor="survey-consent">
                    <Checkbox
                      id="survey-consent"
                      checked={answers.consent}
                      onCheckedChange={(v) => update('consent', v)}
                      disabled={busy}
                    />
                    <span>
                      我同意将问卷和参考照片用于本次拍摄沟通，并授权玉鉴摄影师通过邮件附件或飞书私聊接收这些资料。
                    </span>
                  </label>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="step-actions">
                    <button
                      type="button"
                      className="back-btn"
                      disabled={busy}
                      onClick={() => changeStep('2')}
                    >
                      <ArrowLeft size={16} />
                      返回参考照片
                    </button>
                    <button
                      className="primary-btn"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          正在提交…
                        </>
                      ) : (
                        <>
                          提交拍摄问卷
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </section>
              </form>
            )}
            {step !== '3' && (
              <footer className="step-footer">
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="step-actions">
                  {step !== '0' ? (
                    <button
                      type="button"
                      className="back-btn"
                      onClick={() => changeStep(String(Number(step) - 1))}
                    >
                      <ArrowLeft size={16} />
                      上一步
                    </button>
                  ) : (
                    <span className="step-hint">
                      选好后，继续填写拍摄偏好。
                    </span>
                  )}
                  <button type="button" className="primary-btn" onClick={next}>
                    {step === '2' && uploads.length === 0
                      ? '暂不上传，下一步'
                      : '下一步：' + steps[Number(step) + 1]}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </footer>
            )}
          </section>
          <footer className="questionnaire-footer">
            <LockKeyhole size={14} />
            您的资料仅用于本次拍摄沟通
          </footer>
        </main>
      )}
    </div>
  );
}
