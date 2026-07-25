'use client';

import React, { useState, useEffect } from 'react';

type EndRule = 'desu-masu' | 'da-deu' | 'dekiru' | 'custom';
type Mode = 'single' | 'batch' | 'settings';

interface Pattern {
  title: string;
  text: string;
}

interface StudentRow {
  id: string;
  subject: string;
  memo: string;
  result?: string;
  status?: 'pending' | 'loading' | 'done' | 'error';
}

const AVAILABLE_TAGS = ['自主性・主体性', '協調性・思いやり', '粘り強さ・根気', 'リーダーシップ', '探究心・工夫', '発想力・表現力'];

export default function Generator() {
  const [activeTab, setActiveTab] = useState<Mode>('single');

  // 単体生成用ステート
  const [studentId, setStudentId] = useState('児童A');
  const [subjectOrArea, setSubjectOrArea] = useState('学級所見（総合）');
  const [memo, setMemo] = useState("・理科の実験でグループのリーダーシップを発揮した\n・集中力が切れやすい部分もあるが最後まで取り組んだ");
  const [endRule, setEndRule] = useState<EndRule>('desu-masu');
  const [customEnding, setCustomEnding] = useState('〜に努めた。');
  const [minChars, setMinChars] = useState(120);
  const [maxChars, setMaxChars] = useState(150);
  const [selectedTags, setSelectedTags] = useState<string[]>(['自主性・主体性']);
  
  // 設定保存用（LocalStorage）
  const [customNgWords, setCustomNgWords] = useState('落ち着きがない, わがまま, 集中力がない');

  // API生成結果
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);

  // CSV一括処理用ステート
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // 初期化：保存された設定の読み込み
  useEffect(() => {
    const savedRule = localStorage.getItem('tsunagu_endRule');
    const savedCustomEnd = localStorage.getItem('tsunagu_customEnding');
    const savedNg = localStorage.getItem('tsunagu_ngWords');
    if (savedRule) setEndRule(savedRule as EndRule);
    if (savedCustomEnd) setCustomEnding(savedCustomEnd);
    if (savedNg) setCustomNgWords(savedNg);
  }, []);

  // 設定保存処理
  const saveSchoolRules = () => {
    localStorage.setItem('tsunagu_endRule', endRule);
    localStorage.setItem('tsunagu_customEnding', customEnding);
    localStorage.setItem('tsunagu_ngWords', customNgWords);
    alert('⚙️ 校内ルール設定を保存しました！次回起動時も適用されます。');
  };

  // タグトグル
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // 単体AI生成処理
  const handleGenerate = async () => {
    setLoading(true);
    setPatterns([]);
    setPrivacyWarning(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId, subjectOrArea, episodes: memo,
          endRule, customEnding, minChars, maxChars,
          tags: selectedTags, customNgWords
        })
      });
      const data = await res.json();
      if (data.patterns) {
        setPatterns(data.patterns);
        setSelectedText(data.patterns[0]?.text || '');
        if (data.privacyWarning) setPrivacyWarning(data.privacyWarning);
      }
    } catch (e) {
      alert('生成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // CSV読み込み処理
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      const parsedRows: StudentRow[] = [];

      // 1行目はヘッダーとみなしてスキップ
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length >= 3) {
          parsedRows.push({
            id: cols[0],
            subject: cols[1],
            memo: cols[2],
            status: 'pending'
          });
        }
      }
      setStudents(parsedRows);
    };
    reader.readAsText(file, 'UTF-8');
  };

  // CSV一括自動生成処理
  const handleBatchGenerate = async () => {
    if (students.length === 0) return;
    setBatchLoading(true);

    const updated = [...students];

    for (let i = 0; i < updated.length; i++) {
      updated[i].status = 'loading';
      setStudents([...updated]);

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: updated[i].id,
            subjectOrArea: updated[i].subject,
            episodes: updated[i].memo,
            endRule, customEnding, minChars, maxChars,
            tags: selectedTags, customNgWords
          })
        });
        const data = await res.json();
        if (data.patterns && data.patterns[0]) {
          updated[i].result = data.patterns[0].text;
          updated[i].status = 'done';
        } else {
          updated[i].status = 'error';
        }
      } catch {
        updated[i].status = 'error';
      }
      setStudents([...updated]);
    }
    setBatchLoading(false);
  };

  // 一括作成結果のCSVエクスポート
  const exportBatchCSV = () => {
    let csvStr = "生徒識別,対象領域,観察メモ,AI生成結果\n";
    students.forEach(s => {
      csvStr += `"${s.id}","${s.subject}","${s.memo.replace(/\n/g, ' ')}","${(s.result || '').replace(/\n/g, ' ')}"\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "全員分所見_AI作成結果.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 font-sans text-slate-800">
      {/* ナビゲーションタブ */}
      <div className="flex space-x-2 border-b mb-6">
        <button
          onClick={() => setActiveTab('single')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition ${
            activeTab === 'single' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          ✍️ 1人ずつじっくり作成
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition ${
            activeTab === 'batch' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          ⚡ CSVクラス全員一括作成
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 px-4 font-bold text-sm border-b-2 transition ${
            activeTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          ⚙️ 校内共有ルール・NG辞書
        </button>
      </div>

      {/* タブ1: 1人ずつ個別生成 */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h2 className="text-md font-bold border-b pb-2">入力設定</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">生徒識別（仮名/ID）</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">対象領域・教科</label>
                <input
                  type="text"
                  value={subjectOrArea}
                  onChange={(e) => setSubjectOrArea(e.target.value)}
                  className="w-full p-2.5 text-sm border rounded bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">強調キーワード</label>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_TAGS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-3 py-1 rounded-full border transition ${
                      selectedTags.includes(tag) ? 'bg-blue-600 text-white border-blue-600 font-medium' : 'bg-white text-slate-600 border-slate-300'
                    }`}
                  >
                    {selectedTags.includes(tag) ? '✓ ' : '+ '}{tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">観察メモ</label>
              <textarea
                className="w-full h-28 p-2.5 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition disabled:bg-slate-400"
            >
              {loading ? '✨ AIが文章を作成中...' : '✨ 所見文案を3パターン生成'}
            </button>
          </div>

          <div className="space-y-4">
            <h2 className="text-md font-bold border-b pb-2">生成結果・プレビュー</h2>

            {privacyWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                🛡️ <b>表現の自動ガード:</b> {privacyWarning}
              </div>
            )}

            {patterns.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {patterns.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedText(p.text)}
                    className="p-2 text-left border rounded bg-white hover:border-blue-500 text-xs shadow-sm"
                  >
                    <div className="font-bold text-blue-600 mb-1">{p.title}</div>
                    <div className="line-clamp-3 text-slate-500 leading-relaxed">{p.text}</div>
                  </button>
                ))}
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-600">完成テキスト（手修正可能）</label>
                <span className={`text-xs font-bold ${selectedText.length >= minChars && selectedText.length <= maxChars ? 'text-green-600' : 'text-amber-600'}`}>
                  {selectedText.length} / {maxChars} 文字
                </span>
              </div>
              <textarea
                className="w-full h-44 p-3 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-500 shadow-inner"
                value={selectedText}
                onChange={(e) => setSelectedText(e.target.value)}
              />
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(selectedText);
                alert('クリップボードにコピーしました！');
              }}
              disabled={!selectedText}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded shadow transition disabled:bg-slate-300"
            >
              📋 テキストをコピー
            </button>
          </div>
        </div>
      )}

      {/* タブ2: CSV一括生成 */}
      {activeTab === 'batch' && (
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 border rounded space-y-3">
            <h3 className="font-bold text-sm">1. CSVファイルのアップロード</h3>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="text-sm text-slate-600" />
            <p className="text-xs text-slate-500">※1行目は「生徒識別,対象領域,観察メモ」のヘッダー形式にしてください。</p>
          </div>

          {students.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm">2. 読込データ一覧（{students.length}名分）</h3>
                <button
                  onClick={handleBatchGenerate}
                  disabled={batchLoading}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:bg-slate-400"
                >
                  {batchLoading ? '⏳ 全員分を全自動生成中...' : '🚀 全員分の所見を一括生成'}
                </button>
              </div>

              <div className="border rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      <th className="p-2 border-r w-20">生徒ID</th>
                      <th className="p-2 border-r w-28">領域</th>
                      <th className="p-2 border-r">観察メモ</th>
                      <th className="p-2 border-r">AI自動作成結果</th>
                      <th className="p-2 w-20">状態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50">
                        <td className="p-2 border-r font-bold">{s.id}</td>
                        <td className="p-2 border-r">{s.subject}</td>
                        <td className="p-2 border-r text-slate-600">{s.memo}</td>
                        <td className="p-2 border-r">{s.result || '-'}</td>
                        <td className="p-2 font-bold">
                          {s.status === 'pending' && <span className="text-slate-400">待機中</span>}
                          {s.status === 'loading' && <span className="text-blue-600 animate-pulse">作成中…</span>}
                          {s.status === 'done' && <span className="text-green-600">✓ 完了</span>}
                          {s.status === 'error' && <span className="text-red-600">エラー</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {students.some(s => s.status === 'done') && (
                <button
                  onClick={exportBatchCSV}
                  className="w-full py-3 bg-emerald-600 text-white font-bold rounded hover:bg-emerald-700 shadow"
                >
                  📥 作成結果をまとめてCSVダウンロード
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* タブ3: 校内共通ルール＆NG辞書設定 */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          <div className="space-y-4 p-4 border rounded bg-white shadow-sm">
            <h3 className="font-bold text-sm border-b pb-2">校内共通ルールの一元設定</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">基本の文末語尾ルール</label>
              <select
                value={endRule}
                onChange={(e) => setEndRule(e.target.value as EndRule)}
                className="w-full p-2 text-xs border rounded"
              >
                <option value="desu-masu">通知表用（〜でした/です）</option>
                <option value="da-deu">指導要録用（〜した/である）</option>
                <option value="dekiru">観点型（〜ができる/理解している）</option>
                <option value="custom">独自ルール指定</option>
              </select>
            </div>

            {endRule === 'custom' && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">独自語尾の指定</label>
                <input
                  type="text"
                  value={customEnding}
                  onChange={(e) => setCustomEnding(e.target.value)}
                  className="w-full p-2 text-xs border rounded"
                  placeholder="例: 〜に励んだ。"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">校内NGワード・自動リフレーミング対象（カンマ区切り）</label>
              <textarea
                className="w-full h-24 p-2 text-xs border rounded"
                value={customNgWords}
                onChange={(e) => setCustomNgWords(e.target.value)}
                placeholder="例: 落ち着きがない, わがまま, 集中力がない"
              />
              <p className="text-[10px] text-slate-400 mt-1">※ここに指定した単語は、AIが自動で肯定的な成長表現へ変換します。</p>
            </div>

            <button
              onClick={saveSchoolRules}
              className="w-full py-2 bg-blue-600 text-white font-bold text-xs rounded hover:bg-blue-700"
            >
              💾 設定を端末（ブラウザ）に保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}