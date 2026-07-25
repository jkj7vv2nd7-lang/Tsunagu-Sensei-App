import Generator from '@/components/Generator';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <header className="max-w-6xl mx-auto px-6 mb-4">
        <h1 className="text-2xl font-black text-slate-800">Tsunagu Sensei (MVP)</h1>
        <p className="text-xs text-slate-500">教員向け 所見自動生成＆文字数・文末アジャスター</p>
      </header>
      <Generator />
    </main>
  );
}