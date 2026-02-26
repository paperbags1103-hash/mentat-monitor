/**
 * SettingsPanel — API 키 설정 + 앱 환경 설정
 * 모든 설정은 localStorage에만 저장 (서버 전송 없음)
 */
import { useState, useEffect } from 'react';

interface ApiKeys {
  groq: string;
  fred: string;
  alphavantage: string;
}

const STORAGE_KEY = 'mentat-api-keys-v1';

function loadKeys(): ApiKeys {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as ApiKeys;
  } catch { return { groq: '', fred: '', alphavantage: '' }; }
}

function saveKeys(keys: ApiKeys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  // 앱에 알림 (store에서 apiKeys 읽도록)
  window.dispatchEvent(new Event('mentat-keys-updated'));
}

export function loadApiKey(name: keyof ApiKeys): string {
  return loadKeys()[name] ?? '';
}

interface KeyFieldProps {
  label: string;
  name: keyof ApiKeys;
  value: string;
  onChange: (v: string) => void;
  link?: string;
  desc: string;
  placeholder?: string;
}

function KeyField({ label, name, value, onChange, link, desc, placeholder }: KeyFieldProps) {
  const [show, setShow] = useState(false);
  const hasValue = value.length > 0;
  return (
    <div className="mb-4 p-3 bg-surface border border-border rounded">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary">{label}</span>
          <span className={`text-xs px-1.5 rounded ${hasValue ? 'bg-risk-safe/20 text-risk-safe' : 'bg-border text-muted'}`}>
            {hasValue ? '✓ 설정됨' : '미설정'}
          </span>
        </div>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer"
            className="text-xs text-accent-light hover:underline">발급 받기 →</a>
        )}
      </div>
      <p className="text-xs text-muted mb-2">{desc}</p>
      <div className="flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? `${label} API 키 입력`}
          className="flex-1 bg-base text-xs text-primary px-2 py-1.5 rounded border border-border focus:border-accent/60 outline-none font-mono"
        />
        <button onClick={() => setShow(s => !s)}
          className="text-xs text-muted hover:text-primary px-2 py-1 rounded border border-border">
          {show ? '숨김' : '표시'}
        </button>
      </div>
    </div>
  );
}

export function SettingsPanel() {
  const [keys, setKeys] = useState<ApiKeys>({ groq: '', fred: '', alphavantage: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => { setKeys(loadKeys()); }, []);

  function update(name: keyof ApiKeys, value: string) {
    setKeys(prev => ({ ...prev, [name]: value }));
    setSaved(false);
  }

  function handleSave() {
    saveKeys(keys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    const empty = { groq: '', fred: '', alphavantage: '' };
    setKeys(empty);
    saveKeys(empty);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="text-xs font-bold text-primary">⚙ API 키 설정</div>
        <p className="text-xs text-muted mt-0.5">모든 키는 이 기기 로컬에만 저장됩니다</p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <KeyField
          label="Groq API"
          name="groq"
          value={keys.groq}
          onChange={v => update('groq', v)}
          link="https://console.groq.com/keys"
          desc="AI 테마 발견 + 지정학 인퍼런스 내러티브 생성. 무료 플랜으로 1000req/일 사용 가능."
          placeholder="gsk_..."
        />
        <KeyField
          label="FRED API"
          name="fred"
          value={keys.fred}
          onChange={v => update('fred', v)}
          link="https://fred.stlouisfed.org/docs/api/api_key.html"
          desc="HY/IG 신용 스프레드, TIPS 실질금리 등 미국 연준 데이터. 무료."
          placeholder="abcde..."
        />
        <KeyField
          label="Alpha Vantage"
          name="alphavantage"
          value={keys.alphavantage}
          onChange={v => update('alphavantage', v)}
          link="https://www.alphavantage.co/support/#api-key"
          desc="개별 주식 데이터 보완용. 무료 25req/일."
          placeholder="demo..."
        />

        <div className="border border-border/50 rounded p-3 mt-4 bg-surface/50">
          <div className="text-xs font-bold text-primary mb-2">🔑 키 없이도 작동하는 기능</div>
          <div className="space-y-1">
            {[
              '글로벌 리스크 히트맵 (규칙 기반)',
              '멀티 차트 (Yahoo Finance)',
              '뉴스 피드 (RSS)',
              '공포/탐욕 지수 (내부 계산)',
              '지정학 시나리오 시뮬레이터',
              '포트폴리오 P&L 추적',
              'VaR 분석',
            ].map(f => (
              <div key={f} className="flex items-center gap-1.5 text-xs text-secondary">
                <span className="text-risk-safe text-xs">✓</span> {f}
              </div>
            ))}
          </div>
        </div>

        <div className="border border-accent/30 rounded p-3 mt-3 bg-accent/5">
          <div className="text-xs font-bold text-accent-light mb-2">⚡ API 키 있으면 추가되는 기능</div>
          <div className="space-y-1">
            {[
              ['Groq', 'AI 테마 발견 (30분마다 자동), 지정학 시나리오 AI 서술'],
              ['FRED', 'HY/IG 신용 스프레드 실시간, TIPS 실질금리'],
            ].map(([key, desc]) => (
              <div key={key} className="text-xs">
                <span className="text-accent-light font-bold">{key}:</span>
                <span className="text-secondary ml-1">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-3 py-2.5 border-t border-border shrink-0 flex gap-2">
        <button onClick={handleSave}
          className={`flex-1 text-xs py-1.5 rounded font-semibold transition-colors ${
            saved ? 'bg-risk-safe/20 text-risk-safe border border-risk-safe/40' :
            'bg-accent/20 text-accent-light border border-accent/40 hover:bg-accent/30'
          }`}>
          {saved ? '✓ 저장됨' : '저장'}
        </button>
        <button onClick={handleClear}
          className="text-xs px-3 py-1.5 rounded text-muted border border-border hover:text-risk-critical hover:border-risk-critical/40 transition-colors">
          초기화
        </button>
      </div>
    </div>
  );
}
