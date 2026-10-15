'use client';
import { useEffect, useState } from 'react';
import {
  Aperture,
  ArrowLeft,
  ArrowRight,
  LockKeyhole,
  Loader2,
  RefreshCw,
  LogOut,
  Inbox,
  Download,
  Check,
  ImageIcon,
  Mail,
  Send,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { STYLES } from '@/lib/options';
import { exportSurveysWorkbook, type WorkbookSurvey } from '@/lib/excel-export';
type Survey = WorkbookSurvey & {
  feishu_total?: number;
  feishu_sent?: number;
  feishu_failed?: number;
  email_state?: string;
  email_error?: string;
  email_first_attempt?: number;
};
type ExportState = 'idle' | 'working' | 'success' | 'error';
type BatchExportMode = 'selected' | 'all' | null;
type DeleteTarget = { surveys: Survey[]; source: 'selected' | 'detail' };

export default function Studio() {
  const [logged, setLogged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selected, setSelected] = useState<Survey | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mailConfigured, setMailConfigured] = useState(false);
  const [mailBusy, setMailBusy] = useState(false);
  const [feishuReady, setFeishuReady] = useState(false);
  const [feishuBusy, setFeishuBusy] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportMessage, setExportMessage] = useState('');
  const [batchExportState, setBatchExportState] = useState<ExportState>('idle');
  const [batchExportMessage, setBatchExportMessage] = useState('');
  const [batchExportMode, setBatchExportMode] = useState<BatchExportMode>(null);
  const [selectedForExport, setSelectedForExport] = useState<Survey[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteNotice, setDeleteNotice] = useState('');
  async function load(p = page) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/studio/surveys?page=' + p);
      if (res.status === 401) {
        setLogged(false);
        return;
      }
      const data = (await res.json()) as {
        error?: string;
        surveys: Survey[];
        hasMore: boolean;
        email?: { configured: boolean; recipients: string[] };
        feishu?: { configured: boolean };
      };
      if (!res.ok) throw new Error(data.error);
      setLogged(true);
      setMailConfigured(!!data.email?.configured);
      setFeishuReady(!!data.feishu?.configured);
      setSurveys(data.surveys);
      setSelectedForExport((current) =>
        current.map(
          (item) =>
            data.surveys.find((survey) => survey.id === item.id) || item,
        ),
      );
      setHasMore(data.hasMore);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : '连接失败，请重试。');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load(0);
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/studio/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as {
        error?: string;
        surveys: Survey[];
        hasMore: boolean;
        email?: { configured: boolean; recipients: string[] };
        feishu?: { configured: boolean };
      };
      if (!res.ok) throw new Error(data.error);
      setPassword('');
      await load(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '连接失败，请重试。');
      setLoading(false);
    }
  }
  async function logout() {
    try {
      const res = await fetch('/api/studio/login', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setLogged(false);
      setSurveys([]);
      setSelected(null);
      setSelectedForExport([]);
    } catch {
      setError('退出失败，请重试。');
    }
  }
  async function mark(s: Survey) {
    if (s.status === 'contacted') return;
    setSaving(true);
    setError('');
    try {
      const status = 'contacted';
      const res = await fetch('/api/studio/surveys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: s.id, status }),
      });
      if (!res.ok) throw new Error();
      setSurveys((rows) =>
        rows.map((r) => (r.id === s.id ? { ...r, status } : r)),
      );
      setSelectedForExport((rows) =>
        rows.map((r) => (r.id === s.id ? { ...r, status } : r)),
      );
      setSelected({ ...s, status });
    } catch {
      setError('更新状态失败，请重试。');
    } finally {
      setSaving(false);
    }
  }
  async function retryEmail(s: Survey) {
    setMailBusy(true);
    setError('');
    try {
      const response = await fetch('/api/studio/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyId: s.id }),
      });
      const result = (await response.json()) as {
        state?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || '邮件发送失败。');
      const updated = {
        ...s,
        email_state: result.state,
        email_error: result.error,
      };
      setSelected(updated);
      setSurveys((rows) =>
        rows.map((row) => (row.id === s.id ? updated : row)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '邮件发送失败，请重试。');
    } finally {
      setMailBusy(false);
    }
  }
  async function retryFeishu(s: Survey) {
    setFeishuBusy(true);
    setError('');
    try {
      const response = await fetch('/api/studio/feishu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyId: s.id }),
      });
      const result = (await response.json()) as {
        sent: number;
        total: number;
        error?: string;
        items: { state: string; error?: string }[];
      };
      if (!response.ok) throw new Error(result.error || '飞书发送失败。');
      const updated = {
        ...s,
        feishu_sent: result.sent,
        feishu_total: result.total,
        feishu_failed: result.items.filter((i) =>
          ['failed', 'uncertain'].includes(i.state),
        ).length,
      };
      setSelected(updated);
      setSurveys((rows) =>
        rows.map((row) => (row.id === s.id ? updated : row)),
      );
      if (result.sent < result.total)
        setError(
          result.items.find((i) => i.error)?.error ||
            '部分文件仍在发送中，稍后可再次检查。',
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : '飞书发送失败，请重试。');
    } finally {
      setFeishuBusy(false);
    }
  }
  function mailLabel(state?: string) {
    return (
      (
        {
          pending: '邮件待发送',
          sending: '邮件发送中',
          sent: '邮件服务已接收',
          delivered: '邮件已送达',
          failed: '邮件发送失败',
          uncertain: '发送结果待确认',
        } as Record<string, string>
      )[state || ''] || '未生成自动邮件'
    );
  }
  function summary(s: Survey) {
    return [
      ...STYLES.filter((t) => s.payload.styles.includes(t.id)).map(
        (t) => t.name,
      ),
      ...(s.payload.customStyle ? [s.payload.customStyle] : []),
      ...(s.payload.undecided ? ['一起商量'] : []),
    ].join('、');
  }
  async function exportSurvey(s: Survey) {
    setExportState('working');
    setExportMessage('');
    try {
      const fileSafe = (
        s.name.replace(/[\\/:*?"<>|]/g, '_').trim() || '客户'
      ).slice(0, 40);
      const result = await exportSurveysWorkbook(
        [s],
        '玉鉴-拍摄沟通单-' + fileSafe + '-' + s.id.slice(0, 8) + '.xlsx',
      );
      setExportMessage(
        result.failedImages > 0
          ? `Excel 已下载，成功导出 ${result.images} 张图片，${result.failedImages} 张读取失败；点击缩略图下方的“查看大图”即可放大。`
          : result.images > 0
            ? `Excel 已下载，已嵌入 ${result.images} 张参考图片；点击缩略图下方的“查看大图”即可放大。`
            : 'Excel 已下载，本条记录没有参考照片。',
      );
      setExportState('success');
    } catch {
      setExportMessage('Excel 生成失败，请重试。');
      setExportState('error');
    }
  }

  async function loadAllSurveysForExport() {
    const all: Survey[] = [];
    for (let exportPage = 0; exportPage < 10000; exportPage += 1) {
      const response = await fetch('/api/studio/surveys?page=' + exportPage);
      const result = (await response.json()) as {
        error?: string;
        surveys?: Survey[];
        hasMore?: boolean;
      };
      if (!response.ok || !result.surveys) {
        throw new Error(result.error || '读取全部问卷失败。');
      }
      all.push(...result.surveys);
      if (!result.hasMore) return all;
    }
    throw new Error('问卷数量超过批量导出上限。');
  }

  async function exportAllSurveys() {
    setBatchExportMode('all');
    setBatchExportState('working');
    setBatchExportMessage('正在读取全部问卷与参考照片…');
    try {
      const all = await loadAllSurveysForExport();
      if (all.length === 0) throw new Error('暂无可导出的问卷。');
      const date = new Date().toISOString().slice(0, 10);
      const result = await exportSurveysWorkbook(
        all,
        `玉鉴-全部拍摄沟通单-${date}.xlsx`,
      );
      setBatchExportMessage(
        result.failedImages > 0
          ? `已导出 ${result.records} 组资料、${result.images} 张图片；${result.failedImages} 张图片读取失败。点击缩略图下方的“查看大图”即可放大。`
          : result.images > 0
            ? `已导出 ${result.records} 组资料，并嵌入 ${result.images} 张参考图片；点击缩略图下方的“查看大图”即可放大。`
            : `已导出 ${result.records} 组资料，没有参考照片。`,
      );
      setBatchExportState('success');
    } catch (exportError) {
      setBatchExportMessage(
        exportError instanceof Error
          ? exportError.message
          : '批量导出失败，请重试。',
      );
      setBatchExportState('error');
    } finally {
      setBatchExportMode(null);
    }
  }

  function resetBatchExportNotice() {
    setBatchExportState('idle');
    setBatchExportMessage('');
  }

  function toggleSurveyForExport(survey: Survey, checked: boolean) {
    setSelectedForExport((current) => {
      if (checked) {
        return current.some((item) => item.id === survey.id)
          ? current
          : [...current, survey];
      }
      return current.filter((item) => item.id !== survey.id);
    });
    resetBatchExportNotice();
  }

  function toggleCurrentPage(checked: boolean) {
    const pageIds = new Set(surveys.map((survey) => survey.id));
    setSelectedForExport((current) => {
      if (!checked) return current.filter((item) => !pageIds.has(item.id));
      const selectedById = new Map(current.map((item) => [item.id, item]));
      surveys.forEach((survey) => selectedById.set(survey.id, survey));
      return [...selectedById.values()];
    });
    resetBatchExportNotice();
  }

  async function exportSelectedSurveys() {
    if (selectedForExport.length === 0) return;
    setBatchExportMode('selected');
    setBatchExportState('working');
    setBatchExportMessage(
      `正在导出已选择的 ${selectedForExport.length} 份问卷与参考照片…`,
    );
    try {
      const date = new Date().toISOString().slice(0, 10);
      const result = await exportSurveysWorkbook(
        selectedForExport,
        `玉鉴-已选${selectedForExport.length}份拍摄沟通单-${date}.xlsx`,
      );
      setBatchExportMessage(
        result.failedImages > 0
          ? `已导出所选 ${result.records} 组资料、${result.images} 张图片；${result.failedImages} 张图片读取失败。点击缩略图下方的“查看大图”即可放大。`
          : result.images > 0
            ? `已导出所选 ${result.records} 组资料，并嵌入 ${result.images} 张参考图片；点击缩略图下方的“查看大图”即可放大。`
            : `已导出所选 ${result.records} 组资料，没有参考照片。`,
      );
      setBatchExportState('success');
    } catch (exportError) {
      setBatchExportMessage(
        exportError instanceof Error
          ? exportError.message
          : '所选问卷导出失败，请重试。',
      );
      setBatchExportState('error');
    } finally {
      setBatchExportMode(null);
    }
  }

  function prepareDelete(items: Survey[], source: DeleteTarget['source']) {
    if (!items.length) return;
    setDeleteError('');
    setDeleteTarget({ surveys: items, source });
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const ids = deleteTarget.surveys.map((survey) => survey.id);
    const idSet = new Set(ids);
    const shouldLoadPreviousPage =
      page > 0 && surveys.every((survey) => idSet.has(survey.id));
    setDeleting(true);
    setDeleteError('');
    setDeleteNotice('');
    try {
      const response = await fetch('/api/studio/surveys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const result = (await response.json()) as {
        deleted?: number;
        filesNotRemoved?: number;
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || '删除失败，请重试。');
      setSurveys((rows) => rows.filter((row) => !idSet.has(row.id)));
      setSelectedForExport((rows) =>
        rows.filter((row) => !idSet.has(row.id)),
      );
      if (selected && idSet.has(selected.id)) setSelected(null);
      setDeleteTarget(null);
      const deletedCount = result.deleted || ids.length;
      setDeleteNotice(
        result.filesNotRemoved
          ? `已删除 ${deletedCount} 份沟通记录；${result.filesNotRemoved} 张参考照片未能从存储中清理。`
          : `已删除 ${deletedCount} 份沟通记录和关联参考照片。`,
      );
      if (shouldLoadPreviousPage) await load(page - 1);
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof Error
          ? deleteFailure.message
          : '删除失败，请重试。',
      );
    } finally {
      setDeleting(false);
    }
  }

  const selectedIds = new Set(selectedForExport.map((survey) => survey.id));
  const currentPageAllSelected =
    surveys.length > 0 && surveys.every((survey) => selectedIds.has(survey.id));
  return (
    <>
      <header className="site-header studio-header">
        <a className="brand" href="/">
          <Aperture size={30} />
          <span className="brand-name">
            玉鉴<small>PHOTO STUDIO</small>
          </span>
        </a>
        <nav>
          <a href="/">
            <ArrowLeft size={14} />
            返回客户问卷
          </a>
          {logged && (
            <button className="plain-btn" onClick={logout}>
              <LogOut size={15} />
              退出
            </button>
          )}
        </nav>
      </header>
      <main className="studio-main">
        {!logged ? (
          <div className="login-panel">
            <LockKeyhole size={30} strokeWidth={1.2} />
            <p className="eyebrow">FOR THE PHOTOGRAPHER</p>
            <h1>摄影师工作台</h1>
            <p>查看客户问卷，整理每一次拍摄的想法。</p>
            <form onSubmit={login}>
              <label className="field">
                工作台口令
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入你的专属口令"
                />
              </label>
              <button className="primary-btn" disabled={loading}>
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    进入工作台
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <p className="fine-print">仅摄影师可访问，客户无需登录工作台。</p>
          </div>
        ) : (
          <>
            <section className="section-intro">
              <div>
                <p className="eyebrow">THE STUDIO DESK</p>
                <h1>每份期待，都值得用心。</h1>
                <p>客户提交的拍摄意向与参考照片，会保存在这里。</p>
              </div>
              <div className="studio-toolbar">
                <button
                  className="secondary-btn"
                  onClick={() => void exportSelectedSurveys()}
                  disabled={
                    batchExportState === 'working' ||
                    loading ||
                    selectedForExport.length === 0
                  }
                >
                  {batchExportMode === 'selected' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )}
                  导出已选（{selectedForExport.length}）
                </button>
                <button
                  className="danger-btn"
                  onClick={() =>
                    prepareDelete(selectedForExport, 'selected')
                  }
                  disabled={
                    deleting || loading || selectedForExport.length === 0
                  }
                >
                  <Trash2 size={16} />
                  删除已选（{selectedForExport.length}）
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => void exportAllSurveys()}
                  disabled={
                    batchExportState === 'working' ||
                    loading ||
                    surveys.length === 0
                  }
                >
                  {batchExportMode === 'all' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )}
                  {batchExportMode === 'all'
                    ? '正在批量导出'
                    : '导出全部（含图片）'}
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => load()}
                  disabled={loading}
                >
                  <RefreshCw
                    size={16}
                    className={loading ? 'animate-spin' : ''}
                  />
                  刷新
                </button>
              </div>
            </section>
            {batchExportState !== 'idle' && (
              <p
                className={
                  'batch-export-notice ' +
                  (batchExportState === 'error' ? 'error' : 'success')
                }
                role={batchExportState === 'error' ? 'alert' : 'status'}
              >
                {batchExportState === 'working' ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
                {batchExportMessage}
              </p>
            )}
            {deleteNotice && (
              <output className="delete-notice">
                <Check size={15} />
                {deleteNotice}
              </output>
            )}
            <div
              className={'mail-settings ' + (mailConfigured ? 'enabled' : '')}
            >
              <Mail size={21} />
              <div>
                <strong>
                  收件邮箱：请在部署环境中配置
                </strong>
                <p>
                  {mailConfigured
                    ? '客户提交后，将自动发送问卷沟通单和参考照片附件。'
                    : '邮件发送尚未授权。期间问卷与参考照片会保存为待发送，仍可在工作台查看。'}
                </p>
              </div>
            </div>
            <div className={'mail-settings ' + (feishuReady ? 'enabled' : '')}>
              <Send size={21} />
              <div>
                <strong>飞书：你的私聊</strong>
                <p>
                  {feishuReady
                    ? '问卷沟通单和参考照片会以文件形式发送给你。'
                    : '飞书机器人尚未授权。问卷与照片会保留为待发送，授权后可从详情页发送。'}
                </p>
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {!loading && surveys.length > 0 && (
              <div className="bulk-selection-bar">
                <div className="bulk-select-all">
                  <Checkbox
                    checked={currentPageAllSelected}
                    onCheckedChange={(checked) =>
                      toggleCurrentPage(Boolean(checked))
                    }
                    aria-label="全选本页客户"
                  />
                  全选本页
                </div>
                <span aria-live="polite">
                  已选择 <strong>{selectedForExport.length}</strong> 份
                </span>
                {selectedForExport.length > 0 && (
                  <button
                    type="button"
                    className="clear-selection"
                    onClick={() => {
                      setSelectedForExport([]);
                      resetBatchExportNotice();
                    }}
                  >
                    清空选择
                  </button>
                )}
              </div>
            )}
            {loading ? (
              <div className="studio-empty">
                <Loader2 size={30} className="animate-spin" />
                <p>正在读取拍摄意向…</p>
              </div>
            ) : surveys.length === 0 ? (
              <div className="studio-empty">
                <Inbox size={44} strokeWidth={1} />
                <h2>还没有收到拍摄意向</h2>
                <p>客户提交问卷后，你就能在这里看到完整的想法与参考照片。</p>
                <a href="/" className="secondary-btn">
                  预览客户问卷 <ArrowRight size={16} />
                </a>
              </div>
            ) : (
              <div className="survey-list">
                {surveys.map((s) => (
                  <div
                    className={
                      'survey-select-row ' +
                      (selectedIds.has(s.id) ? 'selected' : '')
                    }
                    key={s.id}
                  >
                    <div className="survey-select-control">
                      <Checkbox
                        checked={selectedIds.has(s.id)}
                        onCheckedChange={(checked) =>
                          toggleSurveyForExport(s, Boolean(checked))
                        }
                        aria-label={`选择 ${s.name} 的沟通记录`}
                      />
                    </div>
                    <button
                      className="survey-card"
                      onClick={() => {
                        setExportState('idle');
                        setExportMessage('');
                        setSelected(s);
                      }}
                    >
                      <div className="survey-avatar">{s.name.slice(0, 1)}</div>
                      <div className="survey-person">
                        <h2>
                          {s.name}
                          <span className={'status-pill ' + s.status}>
                            {s.status === 'new' ? '待沟通' : '已联系'}
                          </span>
                        </h2>
                        <p>{summary(s)}</p>
                        <span>
                          {s.payload.location} · {s.photos.length} 张参考图 ·{' '}
                          {mailLabel(s.email_state)} · 飞书 {s.feishu_sent || 0}/
                          {s.feishu_total || 0}
                        </span>
                      </div>
                      <div className="survey-date">
                        <span>
                          {new Date(s.created_at).toLocaleDateString('zh-CN')}
                        </span>
                        <span>
                          {s.payload.date
                            ? '期望拍摄 ' + s.payload.date
                            : '拍摄日期待沟通'}
                        </span>
                      </div>
                      <ArrowRight size={20} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(page > 0 || hasMore) && (
              <div className="list-paging">
                <button
                  className="secondary-btn"
                  disabled={page === 0 || loading}
                  onClick={() => load(page - 1)}
                >
                  上一页
                </button>
                <span>第 {page + 1} 页</span>
                <button
                  className="secondary-btn"
                  disabled={!hasMore || loading}
                  onClick={() => load(page + 1)}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <Dialog
        open={!!selected}
        disablePointerDismissal
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setExportState('idle');
            setExportMessage('');
          }
        }}
      >
        <DialogContent className="survey-dialog">
          {selected && (
            <>
              <DialogTitle className="dialog-name">
                {selected.name}的拍摄意向
              </DialogTitle>
              <DialogDescription>
                YJ-{selected.id.slice(0, 8).toUpperCase()} ·{' '}
                {new Date(selected.created_at).toLocaleString('zh-CN')}
              </DialogDescription>
              <div className="detail-actions">
                <button
                  className="secondary-btn"
                  disabled={exportState === 'working'}
                  onClick={() => void exportSurvey(selected)}
                >
                  {exportState === 'working' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  {exportState === 'working'
                    ? '正在生成 Excel'
                    : '导出 Excel（含图片）'}
                </button>
                <button
                  className={
                    selected.status === 'contacted'
                      ? 'secondary-btn contacted-btn'
                      : 'primary-btn'
                  }
                  disabled={saving || selected.status === 'contacted'}
                  onClick={() => mark(selected)}
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}{' '}
                  {selected.status === 'contacted' ? '已联系' : '标记已联系'}
                </button>
                <button
                  className="danger-btn detail-delete-btn"
                  disabled={deleting}
                  onClick={() => prepareDelete([selected], 'detail')}
                >
                  <Trash2 size={16} />
                  删除记录
                </button>
              </div>
              {exportState === 'success' && (
                <p className="export-notice success" role="status">
                  <Check size={15} />
                  {exportMessage}
                </p>
              )}
              {exportState === 'error' && (
                <p className="export-notice error" role="alert">
                  {exportMessage}
                </p>
              )}
              {selected.status === 'contacted' && (
                <p className="contacted-confirm">
                  <Check size={15} />
                  已标记为已联系，工作台列表已同步更新。
                </p>
              )}
              <section className="client-files">
                <div className="photo-heading">
                  <ImageIcon size={17} />
                  客户提交的参考照片 · {selected.photos.length} 张
                </div>
                {selected.photos.length > 0 ? (
                  <>
                    <p className="fine-print">
                      点击照片即可在新标签中打开原文件。
                    </p>
                    <div className="reference-gallery">
                      {selected.photos.map((p) => (
                        <a
                          href={
                            '/api/studio/photos/' + selected.id + '/' + p.id
                          }
                          target="_blank"
                          rel="noreferrer"
                          key={p.id}
                        >
                          <img
                            src={
                              '/api/studio/photos/' + selected.id + '/' + p.id
                            }
                            alt={p.name}
                          />
                          <span>
                            {p.name}
                            <ArrowRight size={14} />
                          </span>
                        </a>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="fine-print">客户暂未上传参考照片。</p>
                )}
              </section>
              <div className="review-sheet">
                {Object.entries({
                  联系方式: selected.contact,
                  风格意向: summary(selected),
                  拍摄用途: selected.payload.purpose,
                  场景偏好: selected.payload.location,
                  修图偏好: selected.payload.retouch,
                  妆造准备: selected.payload.makeup,
                  期望日期: selected.payload.date || '待沟通',
                  大致预算: selected.payload.budget || '待沟通',
                  补充想法: selected.payload.notes || '未填写',
                  参考说明: selected.payload.referenceNotes || '未填写',
                }).map(([k, v]) => (
                  <div className="review-row" key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <div className="mail-detail">
                <Mail size={17} />
                <div>
                  <strong>{mailLabel(selected.email_state)}</strong>
                  <p>{selected.email_error || '收件人：Gmail 与 QQ 邮箱'}</p>
                </div>
                {selected.email_state &&
                  !['sent', 'delivered'].includes(selected.email_state) &&
                  (mailConfigured ? (
                    <button
                      className="secondary-btn"
                      onClick={() => retryEmail(selected)}
                      disabled={mailBusy}
                    >
                      {mailBusy ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        '发送 / 重试'
                      )}
                    </button>
                  ) : (
                    <span className="delivery-unavailable">邮件尚未授权</span>
                  ))}
              </div>
              <div className="mail-detail">
                <Send size={17} />
                <div>
                  <strong>
                    飞书私聊：已发送 {selected.feishu_sent || 0} /{' '}
                    {selected.feishu_total || 0} 个文件
                  </strong>
                  <p>
                    {(selected.feishu_failed || 0) > 0
                      ? '部分文件需重试或核对发送结果。'
                      : feishuReady
                        ? '包含问卷沟通单与原始参考照片。'
                        : '尚未配置机器人发送授权。'}
                  </p>
                </div>
                {(selected.feishu_total || 0) > (selected.feishu_sent || 0) &&
                  (feishuReady ? (
                    <button
                      className="secondary-btn"
                      disabled={feishuBusy}
                      onClick={() => retryFeishu(selected)}
                    >
                      {feishuBusy ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        '发送 / 重试'
                      )}
                    </button>
                  ) : (
                    <span className="delivery-unavailable">飞书尚未授权</span>
                  ))}
              </div>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
            setDeleteError('');
          }
        }}
      >
        <AlertDialogContent className="delete-dialog">
          <AlertDialogHeader>
            <div className="delete-dialog-icon" aria-hidden="true">
              <Trash2 size={20} />
            </div>
            <AlertDialogTitle>
              {deleteTarget?.surveys.length === 1
                ? `删除「${deleteTarget.surveys[0].name}」的沟通记录？`
                : `删除已选择的 ${deleteTarget?.surveys.length || 0} 份沟通记录？`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              删除后，工作台中的问卷、参考照片和发送记录将无法恢复。已经发到邮箱或飞书的文件不会被撤回。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="delete-dialog-error" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="delete-confirm-btn"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              {deleting ? '正在删除…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
