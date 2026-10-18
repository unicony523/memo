"use client";

import React, { useState, useEffect, useRef } from "react";

type CategoryType = "전체" | "할 일" | "아이디어" | "기타";
type PostitColor = "yellow" | "pink" | "green" | "blue";
type PinStyle = "flower" | "star" | "heart" | "pushpin" | "bead";

interface PostitItem {
  id: string;
  text: string;
  completed: boolean;
  color: PostitColor;
  pin: PinStyle;
  hasTape: boolean;
  category: "할 일" | "아이디어" | "기타";
  createdAt: string; // Formatted date string
  rotation: string; // e.g. 'rotate-1'
  isNew?: boolean;
}

const PASTEL_COLORS: PostitColor[] = ["yellow", "pink", "green", "blue"];
const PIN_STYLES: PinStyle[] = ["flower", "star", "heart", "pushpin", "bead"];
const ROTATIONS = ["rotate-1", "-rotate-1", "rotate-2", "-rotate-2"];


const COLOR_CONFIGS: Record<
  PostitColor,
  {
    bg: string;
    darkBg: string;
    glowClass: string;
    border: string;
    pattern: string;
    tapeClass: string;
    tapeText: string;
    badgeBg: string;
    badgeText: string;
    name: string;
  }
> = {
  yellow: {
    bg: "bg-[#FEF08A]", // 따뜻하고 귀여운 연노랑 (불투명)
    darkBg: "dark:bg-[#FEF08A]", // 다크모드에서도 칙칙하지 않고 선명한 파스텔 유지
    glowClass: "neon-glow-yellow",
    border: "border-black",
    pattern: "pattern-grid-kitsch",
    tapeClass: "washi-tape-yellow",
    tapeText: "★ MEMO NOTE ★",
    badgeBg: "bg-black text-yellow-300",
    badgeText: "연노랑",
    name: "연노랑",
  },
  pink: {
    bg: "bg-[#FBCFE8]", // 사랑스러운 연분홍 (불투명)
    darkBg: "dark:bg-[#FBCFE8]",
    glowClass: "neon-glow-pink",
    border: "border-black",
    pattern: "pattern-lined-kitsch",
    tapeClass: "washi-tape-pink text-white",
    tapeText: "♥ SWEET NOTE ♥",
    badgeBg: "bg-black text-pink-300",
    badgeText: "연분홍",
    name: "연분홍",
  },
  green: {
    bg: "bg-[#BBF7D0]", // 싱그러운 연두/연초록 (불투명)
    darkBg: "dark:bg-[#BBF7D0]",
    glowClass: "neon-glow-green",
    border: "border-black",
    pattern: "pattern-grid-kitsch",
    tapeClass: "washi-tape-green",
    tapeText: "★ FRESH IDEA ★",
    badgeBg: "bg-black text-emerald-300",
    badgeText: "연두",
    name: "연두",
  },
  blue: {
    bg: "bg-[#BAE6FD]", // 시원한 연파랑 (불투명)
    darkBg: "dark:bg-[#BAE6FD]",
    glowClass: "neon-glow-blue",
    border: "border-black",
    pattern: "pattern-lined-kitsch",
    tapeClass: "washi-tape-blue text-white",
    tapeText: "⚡ COOL TASK ⚡",
    badgeBg: "bg-black text-sky-300",
    badgeText: "연파랑",
    name: "연파랑",
  },
};

const CATEGORY_COLORS: Record<"할 일" | "아이디어" | "기타", string> = {
  "할 일": "bg-amber-400 text-black border-2 border-black",
  "아이디어": "bg-cyan-400 text-black border-2 border-black",
  "기타": "bg-purple-300 text-black border-2 border-black",
};

function formatCreatedDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const day = dayNames[d.getDay()];
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${date} (${day}) ${hours}:${minutes}`;
}

export default function Home() {
  const [notes, setNotes] = useState<PostitItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"할 일" | "아이디어" | "기타">("할 일");
  const [selectedPin, setSelectedPin] = useState<PinStyle>("flower");
  const [hasTape, setHasTape] = useState(true);
  const [filterCategory, setFilterCategory] = useState<CategoryType>("전체");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Edit Modal State
  const [editingNote, setEditingNote] = useState<PostitItem | null>(null);
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState<"할 일" | "아이디어" | "기타">("할 일");

  // Drag & Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Google Apps Script API URL from .env.local
  const GOOGLE_SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL || "";

  // 일기보기 모달 상태 및 구글 시트 데이터 상태
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [sheetLogs, setSheetLogs] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // 구글 시트 데이터 조회 (Read) - 보드판과 일기보기 리스트 동시 동기화
  const fetchSheetData = async (showModal = false) => {
    if (!GOOGLE_SCRIPT_URL) return;
    setIsSyncing(true);
    if (showModal) setIsSheetModalOpen(true);
    try {
      const res = await fetch(`${GOOGLE_SCRIPT_URL}?action=read`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        setSheetLogs(result.data);

        // 구글 시트에 데이터가 존재하면 보드판 메모와 실시간 동기화
        if (result.data.length > 0) {
          const mappedNotes: PostitItem[] = result.data.map((item: any, idx: number) => {
            const validColor: PostitColor = PASTEL_COLORS.includes(item.color) ? item.color : PASTEL_COLORS[idx % 4];
            const validCat: "할 일" | "아이디어" | "기타" = ["할 일", "아이디어", "기타"].includes(item.category)
              ? item.category
              : "할 일";

            return {
              id: String(item.timestamp || Date.now() + idx),
              text: String(item.content || ""),
              completed: item.state === "completed" || item.state === "done",
              color: validColor,
              pin: PIN_STYLES[idx % PIN_STYLES.length],
              hasTape: true,
              category: validCat,
              createdAt: String(item.datetime || formatCreatedDate()),
              rotation: ROTATIONS[idx % ROTATIONS.length],
            };
          });
          setNotes(mappedNotes);
          localStorage.setItem("memo_items_v2", JSON.stringify(mappedNotes));
        }
      }
    } catch (err) {
      console.error("구글 시트 조회 실패:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // 구글 시트 API 전송 헬퍼 (CORS 우회를 위해 no-cors 및 파라미터 백업 지원)
  const sendToGoogleSheet = async (payload: any) => {
    if (!GOOGLE_SCRIPT_URL) return;
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("구글 시트 요청 에러:", err);
    }
  };

  // Load from localStorage & Theme setup & Initial Google Sheet Sync
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("memo_theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }

    const savedNotes = localStorage.getItem("memo_items_v2");
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch {
        initDefaultNotes();
      }
    } else {
      initDefaultNotes();
    }

    // 초기 실행 시 구글 시트 데이터와 동기화
    fetchSheetData(false);
  }, []);

  const initDefaultNotes = () => {
    const defaultData: PostitItem[] = [
      {
        id: "note-1",
        text: "위에는 귀여운 테이프가 붙여진 상태로 포스트잇이 붙어짐. ✏️ 와시 테이프와 레드 플라워 핀이 콕!",
        completed: false,
        color: "yellow",
        pin: "flower",
        hasTape: true,
        category: "할 일",
        createdAt: formatCreatedDate(new Date(Date.now() - 1000 * 60 * 180)),
        rotation: "-rotate-1",
      },
      {
        id: "note-2",
        text: "디자인 시스템 정리하기 & 주간 회의 준비 📑\n• 컴포넌트 폰트 사이즈 통일\n• 귀여운 핀 아이콘 에셋 내보내기",
        completed: false,
        color: "pink",
        pin: "star",
        hasTape: false,
        category: "할 일",
        createdAt: formatCreatedDate(new Date(Date.now() - 1000 * 60 * 120)),
        rotation: "rotate-1",
      },
      {
        id: "note-3",
        text: "퇴근길 장보기 목록 🍓\n- 서울우유 1팩 🥛\n- 생딸기 한 상자\n- 귀여운 문구점 들르기!",
        completed: true,
        color: "green",
        pin: "bead",
        hasTape: false,
        category: "기타",
        createdAt: formatCreatedDate(new Date(Date.now() - 1000 * 60 * 60)),
        rotation: "-rotate-2",
      },
      {
        id: "note-4",
        text: '오늘 할 일 완료! 나를 위한 칭찬 한마디 ✨ "포기하지 않고 끝까지 해낸 내가 제일 멋지다! 저녁엔 맛있는 디저트 먹기."',
        completed: false,
        color: "blue",
        pin: "pushpin",
        hasTape: true,
        category: "아이디어",
        createdAt: formatCreatedDate(new Date(Date.now() - 1000 * 60 * 15)),
        rotation: "rotate-2",
      },
    ];
    setNotes(defaultData);
    localStorage.setItem("memo_items_v2", JSON.stringify(defaultData));
  };

  const saveNotes = (updated: PostitItem[]) => {
    setNotes(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("memo_items_v2", JSON.stringify(updated));
    }
  };

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("memo_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("memo_theme", "light");
    }
  };

  // [저장] 버튼: 일기/포스트잇 추가 및 구글 시트에 Create
  const handleAddNote = async () => {
    if (!inputText.trim()) return;

    const randomColor = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];
    const randomRotation = ROTATIONS[Math.floor(Math.random() * ROTATIONS.length)];
    const currentTimestamp = Date.now().toString();
    const formattedDate = formatCreatedDate();

    const newNote: PostitItem = {
      id: currentTimestamp,
      text: inputText.trim(),
      completed: false,
      color: randomColor,
      pin: selectedPin,
      hasTape: hasTape,
      category: selectedCategory,
      createdAt: formattedDate,
      rotation: randomRotation,
      isNew: true,
    };

    saveNotes([newNote, ...notes]);
    setInputText("");

    // 구글 시트로 Create 요청 전송
    setSyncMessage("구글 시트에 일기를 저장하는 중...");
    await sendToGoogleSheet({
      action: "create",
      timestamp: currentTimestamp,
      datetime: formattedDate,
      category: selectedCategory,
      content: newNote.text,
      color: randomColor,
      state: "active",
      order: 0,
    });
    setSyncMessage("구글 시트 저장 완료! ✨");
    setTimeout(() => setSyncMessage(null), 3000);
  };

  // Delete Note: 로컬 삭제 및 구글 시트 Delete
  const handleDeleteNote = async (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    saveNotes(updated);

    // 구글 시트에 삭제 요청
    await sendToGoogleSheet({
      action: "delete",
      timestamp: id,
    });
    // 일기 모달 열려있으면 목록 갱신
    if (isSheetModalOpen) {
      setSheetLogs((prev) => prev.filter((item) => String(item.timestamp) !== String(id)));
    }
  };

  // Toggle complete: 상태 변경 및 구글 시트 Update
  const handleToggleComplete = async (id: string) => {
    const target = notes.find((n) => n.id === id);
    if (!target) return;
    const nextState = !target.completed;
    const updated = notes.map((n) => (n.id === id ? { ...n, completed: nextState } : n));
    saveNotes(updated);

    // 구글 시트 state 업데이트
    await sendToGoogleSheet({
      action: "update",
      timestamp: id,
      state: nextState ? "completed" : "active",
    });
  };

  // Open Edit Modal
  const openEditModal = (note: PostitItem) => {
    setEditingNote(note);
    setEditText(note.text);
    setEditCategory(note.category);
  };

  // Save Edit: 로컬 수정 및 구글 시트 Update
  const handleSaveEdit = async () => {
    if (!editingNote || !editText.trim()) return;
    const updated = notes.map((n) =>
      n.id === editingNote.id ? { ...n, text: editText.trim(), category: editCategory } : n
    );
    saveNotes(updated);

    // 구글 시트에 수정 요청
    await sendToGoogleSheet({
      action: "update",
      timestamp: editingNote.id,
      content: editText.trim(),
      category: editCategory,
      datetime: formatCreatedDate(),
    });

    setEditingNote(null);
  };

  // Clear completed
  const handleClearCompleted = () => {
    const completedList = notes.filter((n) => n.completed);
    completedList.forEach((n) => {
      sendToGoogleSheet({ action: "delete", timestamp: n.id });
    });
    const updated = notes.filter((n) => !n.completed);
    saveNotes(updated);
  };

  // Drag and Drop (PC Mouse)
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...notes];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, moved);
    saveNotes(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // 구글 시트에 Reorder 요청
    const reorderItems = updated.map((n, idx) => ({ timestamp: n.id, order: idx }));
    await sendToGoogleSheet({
      action: "reorder",
      items: reorderItems,
    });
  };

  // Touch Drag State for Mobile
  const touchStartY = useRef<number>(0);
  const touchActiveCardIndex = useRef<number | null>(null);

  // Mobile Touch Move Card
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchActiveCardIndex.current = index;
  };

  const handleTouchEnd = (index: number, e: React.TouchEvent) => {
    if (touchActiveCardIndex.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    // 세로 스와이프 거리가 일정 이상이면 위/아래 이동
    if (Math.abs(deltaY) > 60) {
      const direction = deltaY > 0 ? 1 : -1;
      const targetIndex = index + direction;
      if (targetIndex >= 0 && targetIndex < notes.length) {
        const updated = [...notes];
        const [moved] = updated.splice(index, 1);
        updated.splice(targetIndex, 0, moved);
        saveNotes(updated);
      }
    }
    touchActiveCardIndex.current = null;
  };

  // Move Card Manually (Mobile Helper Buttons)
  const moveCard = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= notes.length) return;
    const updated = [...notes];
    const [moved] = updated.splice(index, 1);
    updated.splice(target, 0, moved);
    saveNotes(updated);
  };

  // Filtering
  const filteredNotes = notes.filter((note) => {
    if (filterCategory === "전체") return true;
    return note.category === filterCategory;
  });

  const renderPinIcon = (pin: PinStyle) => {
    switch (pin) {
      case "flower":
        return (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 animate-pin-stab" title="꽃 모양 핀">
            <svg className="w-8 h-8 drop-shadow-md" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="10" r="4.5" fill="#FF2E93" stroke="#000" strokeWidth="2" />
              <circle cx="21" cy="13" r="4.5" fill="#FF2E93" stroke="#000" strokeWidth="2" />
              <circle cx="19.5" cy="19" r="4.5" fill="#FF2E93" stroke="#000" strokeWidth="2" />
              <circle cx="12.5" cy="19" r="4.5" fill="#FF2E93" stroke="#000" strokeWidth="2" />
              <circle cx="11" cy="13" r="4.5" fill="#FF2E93" stroke="#000" strokeWidth="2" />
              <circle cx="16" cy="15" r="3.2" fill="#FFE600" stroke="#000" strokeWidth="2" />
              <circle cx="15.2" cy="13.8" r="1.2" fill="#FFF" />
            </svg>
          </div>
        );
      case "star":
        return (
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 animate-pin-stab" title="별 핀">
            <svg className="w-7 h-7 drop-shadow-md" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 3L19.5 12H29L21.5 17.5L24.5 27L16 21.5L7.5 27L10.5 17.5L3 12H12.5L16 3Z"
                fill="#FFE600"
                stroke="#000"
                strokeWidth="2"
              />
              <circle cx="14" cy="11" r="1.3" fill="#FFF" />
            </svg>
          </div>
        );
      case "heart":
        return (
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 animate-pin-stab" title="하트 핀">
            <svg className="w-7 h-7 drop-shadow-md" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 27C16 27 5 19.5 5 12.2C5 8.2 8.2 5 12.2 5C14.5 5 15.6 6.3 16 7.2C16.4 6.3 17.5 5 19.8 5C23.8 5 27 8.2 27 12.2C27 19.5 16 27 16 27Z"
                fill="#FF0055"
                stroke="#000"
                strokeWidth="2"
              />
              <circle cx="12" cy="9.5" r="1.5" fill="#FFF" />
            </svg>
          </div>
        );
      case "pushpin":
        return (
          <div className="absolute top-2 right-4 z-30 animate-pin-stab" title="볼드 푸시핀">
            <svg className="w-7 h-7 drop-shadow-md" viewBox="0 0 32 32" fill="none">
              <path
                d="M12 6C12 4.5 13.5 4 16 4C18.5 4 20 4.5 20 6L18.5 12H23L19 18H17V27H15V18H13L9 12H13.5L12 6Z"
                fill="#00E5FF"
                stroke="#000"
                strokeWidth="1.8"
              />
              <ellipse cx="16" cy="6" rx="3.5" ry="1.2" fill="#FFF" />
            </svg>
          </div>
        );
      case "bead":
        return (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-30 animate-pin-stab" title="보라 구슬 핀">
            <svg className="w-8 h-8 drop-shadow-md" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="13" r="7.5" fill="#A855F7" stroke="#000" strokeWidth="2" />
              <circle cx="13.5" cy="10.5" r="2.2" fill="#FFF" />
              <path d="M16 21V28" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
        );
    }
  };

  if (!mounted) return null;

  return (
    <div className={`min-h-screen flex flex-col font-sans neo-dot-bg selection:bg-[#FF7AC6] selection:text-black ${isDarkMode ? "dark text-zinc-100" : "text-black"}`}>
      {/* 상단 네오 브루탈리즘 헤더 */}
      <header className="w-full border-b-4 border-black bg-[#67E8F9] dark:bg-[#0891b2] shadow-brutal-md relative z-10">
        <div className="h-3 w-full kitsch-stripes border-b-2 border-black" />
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-5 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#FFE600] border-3 border-black rounded-full flex items-center justify-center shadow-brutal-sm text-2xl font-black shrink-0 animate-[spin_12s_linear_infinite]">
              🌸
            </div>
            <div>
              <div className="inline-flex items-center gap-2 bg-black text-[#FFE600] px-2.5 py-0.5 rounded-md text-xs font-pop tracking-wider">
                <span>OFFICE & KITSCH POP NOTES</span>
                <span className="text-white">★</span>
                <span className="text-[#5EEAD4]">NEO-BRUTAL</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-display font-extrabold text-black dark:text-white tracking-tight flex items-center justify-center md:justify-start gap-2 mt-0.5">
                <span>✏️</span> POST-IT TODO BOARD <span>📌</span>
              </h1>
            </div>
          </div>

          {/* 우측 컨트롤: 오늘 할 일 뱃지 및 다크 모드 토글 */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex bg-white dark:bg-zinc-800 border-3 border-black px-4 py-1.5 rounded-xl shadow-brutal-sm rotate-1 hover:rotate-0 transition-transform">
              <p className="font-pop text-base md:text-lg text-black dark:text-zinc-100 flex items-center gap-2">
                <span className="animate-bounce">⚡</span> 오늘 할 일 사각사각 착! 붙이기!
              </p>
            </div>

            {/* 다크 / 라이트 모드 토글 버튼 */}
            <button
              onClick={toggleTheme}
              className="brutal-btn px-3 py-1.5 bg-[#FFE600] text-black border-3 border-black rounded-xl font-pop text-sm font-bold flex items-center gap-2 shadow-brutal cursor-pointer"
              title="라이트/다크 모드 전환"
            >
              <span>{isDarkMode ? "🌙 다크 모드" : "☀️ 라이트 모드"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 메인 컨테이너 */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 md:py-8 flex flex-col items-center">
        {/* 타이틀 배너 배지 */}
        <div className="mb-6 inline-flex items-center gap-2 px-6 py-2.5 bg-[#FF7AC6] border-3 border-black rounded-2xl shadow-brutal text-black font-pop text-xl md:text-2xl transform -rotate-1 hover:rotate-0 transition-transform">
          <span className="text-2xl">📋</span>
          <span className="tracking-wide">착! 키치 포스트잇 투두보드</span>
          <span className="text-xs font-display bg-black text-white px-2.5 py-1 rounded-lg font-black uppercase">
            V 2.0 POP
          </span>
        </div>

        {/* 입력 섹션 (3D 네오 브루탈리즘 카드) */}
        <section className={`w-full max-w-3xl border-3 border-black rounded-3xl p-5 md:p-7 shadow-brutal-lg relative mb-8 transition-colors ${
          isDarkMode ? "bg-[#BAE6FD]" : "bg-[#FCE7F3]"
        }`}>
          {/* 상단 와시 테이프 */}
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-40 h-7 washi-tape-yellow rotate-2 flex items-center justify-center font-display font-black text-xs tracking-widest text-black z-20">
            ★ MEMO PAD ★
          </div>

          {/* 모서리 키치 스티커 */}
          <div
            className="absolute -top-3 -right-3 w-10 h-10 bg-[#5EEAD4] border-2 border-black rounded-full flex items-center justify-center shadow-brutal-sm text-lg rotate-12 z-20"
            title="스마일!"
          >
            😋
          </div>
          <div
            className="absolute -bottom-3 -left-3 w-9 h-9 bg-[#FFE600] border-2 border-black rounded-full flex items-center justify-center shadow-brutal-sm text-base -rotate-12 z-20"
            title="반짝이!"
          >
            ✨
          </div>

          <div className="text-center mb-4 mt-1">
            <label className="inline-block text-xl md:text-2xl font-pop text-black tracking-wide">
              ✨ 오늘의 포스트는? (입력칸)
            </label>
            <p className="text-xs md:text-sm text-stone-700 font-sans font-medium mt-0.5">
              잊지 말아야 할 할 일, 따뜻한 메모, 혹은 목표를 힙하고 귀엽게 작성해보세요!
            </p>
          </div>

          {/* 텍스트 입력창 */}
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value.slice(0, 100))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
              placeholder="오늘 할 일이나 간직하고 싶은 메모를 입력해보세요... (예: 힙한 디자인 시스템 정리 & 딸기 와플 먹기 🍓)"
              rows={3}
              className="w-full border-3 border-black rounded-2xl p-4 text-base md:text-lg focus:outline-none focus:ring-4 focus:ring-[#FFE600] focus:border-black transition resize-none placeholder:text-stone-400 pattern-lined-kitsch leading-relaxed text-black font-hand text-xl bg-[#FFFEEF] shadow-brutal-sm"
            />
            <span
              className={`absolute bottom-3 right-4 text-xs font-display font-bold px-2 py-0.5 border-2 border-black rounded-md shadow-brutal-sm ${
                inputText.length >= 100 ? "bg-red-500 text-white" : "bg-white text-black"
              }`}
            >
              {inputText.length} / 100자
            </span>
          </div>

          {/* 옵션 설정 바: 카테고리 선택, 핀 스타일, 테이프 옵션, 컬러 안내 */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 pt-4 border-t-2 border-black border-dashed">
            {/* 카테고리 선택 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-pop font-bold text-black text-sm uppercase">카테고리:</span>
              <div className="flex items-center gap-1.5">
                {(["할 일", "아이디어", "기타"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 text-xs font-pop rounded-xl border-2 border-black shadow-brutal-sm transition-transform cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-black text-[#FFE600] scale-105"
                        : "bg-white text-black hover:bg-yellow-50"
                    }`}
                  >
                    {cat === "할 일" ? "📝 " : cat === "아이디어" ? "💡 " : "📌 "}
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 핀 스타일 선택 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-pop font-bold text-black text-sm uppercase">핀 스타일:</span>
              <div className="flex items-center gap-1.5 bg-[#FFFDE0] p-1 rounded-xl border-2 border-black shadow-brutal-sm">
                {PIN_STYLES.map((pin) => (
                  <button
                    key={pin}
                    type="button"
                    onClick={() => setSelectedPin(pin)}
                    className={`p-1 rounded-lg border-2 transition cursor-pointer ${
                      selectedPin === pin
                        ? "bg-white border-black shadow-brutal-sm"
                        : "border-transparent hover:bg-yellow-100"
                    }`}
                    title={pin}
                  >
                    {pin === "flower" && <span className="text-base">🌸</span>}
                    {pin === "star" && <span className="text-base">⭐</span>}
                    {pin === "heart" && <span className="text-base">💖</span>}
                    {pin === "pushpin" && <span className="text-base">📌</span>}
                    {pin === "bead" && <span className="text-base">🔮</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* 테이프 부착 여부 & 무작위 파스텔 컬러 안내 */}
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-pop text-black select-none">
                <input
                  type="checkbox"
                  checked={hasTape}
                  onChange={(e) => setHasTape(e.target.checked)}
                  className="w-5 h-5 rounded-md border-2 border-black text-[#FFE600] focus:ring-0 shadow-brutal-sm cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  형광 테이프 ⚡
                  {hasTape && <span className="text-[11px] text-pink-600 font-bold">(은은한 빛 추가!)</span>}
                </span>
              </label>

              <div
                className="inline-flex items-center gap-1.5 text-xs font-pop bg-white text-black px-2.5 py-1 rounded-lg border border-black shadow-brutal-sm"
                title="메모 생성 시 연노랑, 연분홍, 연두, 연파랑 중 무작위 배정됩니다"
              >
                <span>🎨 파스텔 4색</span>
                <div className="flex -space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FEF08A] border border-black" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FBCFE8] border border-black" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#BBF7D0] border border-black" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#BAE6FD] border border-black" />
                </div>
              </div>
            </div>
          </div>

          {/* 착!! 포스트잇 붙이기! 버튼 영역 */}
          <div className="mt-6 text-center">
            <button
              onClick={handleAddNote}
              type="button"
              className="brutal-btn w-full md:w-3/5 mx-auto py-3.5 px-6 bg-[#FFE600] border-3 border-black text-black font-pop text-xl md:text-2xl tracking-wide rounded-2xl shadow-brutal-md flex items-center justify-center gap-3 cursor-pointer"
            >
              <span className="text-3xl animate-bounce">📌</span>
              <span>착!! 포스트잇 붙이기!</span>
              <span className="text-xs bg-black text-white px-2.5 py-1 rounded-md font-display font-black tracking-wider">
                ENTER ↵
              </span>
            </button>
          </div>

          {/* 구글 시트 동기화 상태 피드백 */}
          {syncMessage && (
            <div className="mt-3 text-center">
              <span className="inline-block px-3 py-1 bg-black text-[#FFE600] text-xs font-pop rounded-lg border border-black shadow-brutal-sm animate-pulse">
                {syncMessage}
              </span>
            </div>
          )}
        </section>

        {/* 상태 바 및 카테고리 필터링 드롭다운 */}
        <div className="w-full flex flex-wrap items-center justify-between mb-6 px-1 gap-4">
          {/* 맨 왼쪽 그룹: 타이틀 + 총 개수 버튼 + 핫핑크 드래그 안내 네모 배지 */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* 요구사항: 파란색 네모칸 안에 검은 글씨로 보여지도록 수정 */}
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#38BDF8] text-black border-2 border-black rounded-xl shadow-brutal-sm font-pop text-lg md:text-xl font-bold tracking-tight">
              <span>📌</span>
              <span>포스트잇 보드판</span>
            </div>

            {/* 총 포스트잇 개수 버튼 (맨 왼쪽 배치) */}
            <span className="text-xs md:text-sm font-display font-black bg-[#FFE600] border-2 border-black text-black px-3.5 py-1.5 rounded-full shadow-brutal-sm uppercase tracking-wide">
              총 {filteredNotes.length}개의 포스트잇
            </span>

            {/* 요구사항: 핫핑크 네모 칸 안에 검은색 글씨, 총 개수 버튼 옆에 위치 */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF7AC6] text-black border-2 border-black rounded-xl shadow-brutal-sm font-pop text-xs md:text-sm font-bold tracking-tight">
              <span>🖐️</span>
              <span>마우스나 손가락으로 카드를 끌어서 위치를 자유롭게 변경해보세요!</span>
            </div>
          </div>

          {/* 우측 그룹: 카테고리 필터 드롭다운 (설명 라벨 제거) & 완료된 포스트 떼기 */}
          <div className="flex items-center gap-3 font-pop text-base flex-wrap">
            <div className="relative inline-block">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as CategoryType)}
                className="bg-white dark:bg-zinc-800 text-black dark:text-white border-2 border-black rounded-xl px-3 py-1.5 text-sm font-pop font-bold shadow-brutal-sm focus:outline-none focus:ring-2 focus:ring-[#FFE600] cursor-pointer"
              >
                <option value="전체">🌟 전체보기</option>
                <option value="할 일">📝 할 일</option>
                <option value="아이디어">💡 아이디어</option>
                <option value="기타">📌 기타</option>
              </select>
            </div>

            <span className="text-black dark:text-zinc-400 font-bold">/</span>

            <button
              onClick={handleClearCompleted}
              className="bg-[#FF7AC6] text-black px-3.5 py-1.5 rounded-xl font-bold border-2 border-black shadow-brutal-sm hover:translate-x-0.5 hover:translate-y-0.5 transition cursor-pointer text-sm"
              title="완료된 체크 포스트잇 모두 제거"
            >
              완료된 포스트 떼기 🗑️
            </button>
          </div>
        </div>

        {/* 포스트잇 그리드: 한 행에 정확히 4개 배치 (lg:grid-cols-4)
            한 줄에 4개가 다 차면 바로 아래 맨 왼쪽부터 다시 메모 배치 */}
        <div
          className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-start auto-rows-fr"
          id="postitContainer"
        >
          {filteredNotes.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-white/70 dark:bg-zinc-800/70 border-3 border-dashed border-black rounded-3xl p-8">
              <span className="text-5xl">📄</span>
              <p className="font-pop text-2xl text-stone-700 dark:text-stone-300 mt-3">
                해당 카테고리의 포스트잇이 없습니다!
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                위 입력창에서 새로운 메모를 작성하고 붙여보세요 ✨
              </p>
            </div>
          ) : (
            filteredNotes.map((note, index) => {
              const cfg = COLOR_CONFIGS[note.color] || COLOR_CONFIGS.yellow;
              const isDragging = draggedIndex === index;
              const isOver = dragOverIndex === index;
              // 형광 테이프가 있을 때 은은하게 빛나는 글로우 클래스
              const glowClass = note.hasTape ? cfg.glowClass : "";

              return (
                <article
                  key={note.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onTouchStart={(e) => handleTouchStart(index, e)}
                  onTouchEnd={(e) => handleTouchEnd(index, e)}
                  style={{ "--rot": note.rotation.includes("-") ? "-1.5deg" : "1.5deg" } as React.CSSProperties}
                  className={`postit-card group relative ${cfg.bg} ${cfg.darkBg} ${cfg.pattern} rounded-2xl p-5 pt-8 border-3 border-black ${
                    note.hasTape ? glowClass : "shadow-brutal-md"
                  } hover:shadow-brutal-lg transition-all duration-150 transform ${
                    note.rotation
                  } hover:rotate-0 hover:-translate-y-1 flex flex-col justify-between min-h-[300px] cursor-grab active:cursor-grabbing ${
                    note.isNew ? "animate-slap-stick" : ""
                  } ${isDragging ? "dragging-card" : ""} ${isOver ? "drag-over-card" : ""}`}
                >
                  {/* 형광 와시 테이프 (옵션) */}
                  {note.hasTape && (
                    <div
                      className={`absolute -top-3.5 left-1/2 -translate-x-1/2 w-32 h-6 ${cfg.tapeClass} rotate-1 z-20 flex items-center justify-center font-display font-black text-[10px] select-none`}
                    >
                      {cfg.tapeText}
                    </div>
                  )}

                  {/* 핀 아이콘 */}
                  {renderPinIcon(note.pin)}

                  {/* 반짝이 아이콘 & 모바일 이동 버튼 */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 z-20">
                    <span className="text-sm select-none opacity-80 group-hover:scale-125 transition-transform">
                      ✨
                    </span>
                  </div>

                  {/* 콘텐츠 영역 */}
                  <div className="mt-4 flex-1">
                    {/* 카테고리 태그 뱃지 */}
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-pop font-black rounded-md shadow-brutal-sm ${
                          CATEGORY_COLORS[note.category]
                        }`}
                      >
                        {note.category === "할 일" && "📝 "}
                        {note.category === "아이디어" && "💡 "}
                        {note.category === "기타" && "📌 "}
                        {note.category}
                      </span>

                      {/* 모바일 순서 변경 도우미 버튼 */}
                      <div className="flex sm:hidden items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveCard(index, -1)}
                          disabled={index === 0}
                          className="px-1.5 py-0.5 bg-white text-black border border-black rounded text-[10px] font-bold disabled:opacity-30"
                          title="앞으로 이동"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCard(index, 1)}
                          disabled={index === notes.length - 1}
                          className="px-1.5 py-0.5 bg-white text-black border border-black rounded text-[10px] font-bold disabled:opacity-30"
                          title="뒤로 이동"
                        >
                          ▶
                        </button>
                      </div>
                    </div>

                    {/* 메모 텍스트 내용 */}
                    <p
                      className={`font-pop text-xl md:text-2xl text-black leading-snug break-words whitespace-pre-wrap ${
                        note.completed ? "line-through opacity-50" : ""
                      }`}
                    >
                      {note.text}
                    </p>
                  </div>

                  {/* 카드 하단 푸터 */}
                  <div className="mt-4 pt-3 border-t-2 border-black border-dashed flex flex-col gap-2">
                    {/* 상단 액션: 체크박스 + 편집 + 삭제 */}
                    <div className="flex items-center justify-between text-xs font-bold">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer font-pop text-sm select-none text-black">
                        <input
                          type="checkbox"
                          checked={note.completed}
                          onChange={() => handleToggleComplete(note.id)}
                          className="todo-check rounded-md text-black focus:ring-0 w-4 h-4 border-2 border-black cursor-pointer"
                        />
                        <span className={note.completed ? "line-through text-stone-600" : ""}>완료 착!</span>
                      </label>

                      <div className="flex items-center gap-1.5">
                        {/* 편집 버튼 */}
                        <button
                          type="button"
                          onClick={() => openEditModal(note)}
                          className="bg-white hover:bg-[#FFE600] text-black border-2 border-black rounded-lg px-1.5 py-0.5 text-xs font-black shadow-brutal-sm transition cursor-pointer"
                          title="포스트잇 편집"
                        >
                          ✏️ 수정
                        </button>

                        {/* 삭제 버튼 */}
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          className="bg-white hover:bg-black hover:text-white text-black border-2 border-black rounded-lg w-6 h-6 flex items-center justify-center text-xs font-black shadow-brutal-sm transition cursor-pointer"
                          title="포스트잇 떼기 (삭제)"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* 요구사항: 각 메모의 왼쪽 하단에 작성한 연월일 시간 요일을 작은 글씨로 흐릿하게 표시 */}
                    <div className="text-left">
                      <span className="font-sans text-[10px] text-stone-700/60 font-medium select-none tracking-tight">
                        🕒 {note.createdAt}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </main>

      {/* Footer 영역 */}
      <footer className="w-full mt-12 py-6 border-t-3 border-black bg-white dark:bg-zinc-900 text-center relative z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center gap-2">
          <p className="font-pop text-sm md:text-base text-black dark:text-zinc-200 tracking-wide flex items-center justify-center gap-1.5">
            <span>✨</span>
            <span>Copyright INU Post-it Todo List by 조아현</span>
            <span>✨</span>
          </p>
        </div>
      </footer>

      {/* 편집 모달 (Neo-Brutalism Modal Popup) */}
      {editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border-4 border-black rounded-3xl p-6 shadow-brutal-lg relative animate-slap-stick">
            {/* 닫기 버튼 */}
            <button
              type="button"
              onClick={() => setEditingNote(null)}
              className="absolute top-4 right-4 w-8 h-8 bg-[#FF7AC6] border-2 border-black rounded-xl font-black text-black shadow-brutal-sm hover:scale-110 transition flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>

            <div className="mb-4 flex items-center gap-2">
              <span className="text-2xl">✏️</span>
              <h2 className="text-2xl font-pop font-extrabold text-black dark:text-white">포스트잇 내용 수정하기</h2>
            </div>

            {/* 카테고리 변경 */}
            <div className="mb-4">
              <label className="block text-xs font-pop font-bold mb-1.5 text-black dark:text-zinc-200">
                카테고리 변경:
              </label>
              <div className="flex gap-2">
                {(["할 일", "아이디어", "기타"] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setEditCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-pop rounded-xl border-2 border-black shadow-brutal-sm transition-transform cursor-pointer ${
                      editCategory === cat
                        ? "bg-black text-[#FFE600] scale-105"
                        : "bg-white dark:bg-zinc-800 text-black dark:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 텍스트 내용 수정 */}
            <div className="mb-5">
              <label className="block text-xs font-pop font-bold mb-1.5 text-black dark:text-zinc-200">
                메모 본문:
              </label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value.slice(0, 100))}
                rows={4}
                className="w-full border-3 border-black rounded-2xl p-4 text-lg font-hand leading-relaxed bg-[#FFFEEF] text-black shadow-brutal-sm focus:outline-none focus:ring-4 focus:ring-[#FFE600]"
              />
              <span className="text-xs text-stone-500 font-display block text-right mt-1">
                {editText.length} / 100자
              </span>
            </div>

            {/* 모달 액션 버튼 */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingNote(null)}
                className="px-4 py-2 bg-stone-200 text-black border-2 border-black rounded-xl font-pop text-sm font-bold shadow-brutal-sm cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-[#FFE600] text-black border-2 border-black rounded-xl font-pop text-base font-bold shadow-brutal hover:translate-x-0.5 hover:translate-y-0.5 transition cursor-pointer"
              >
                수정 완료 착! ✨
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [일기보기] 구글 시트 일기 리스트 모달 (Neo-Brutalism Kitsch Pop) */}
      {isSheetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-white dark:bg-zinc-900 border-4 border-black rounded-3xl p-6 shadow-brutal-lg relative max-h-[85vh] flex flex-col animate-slap-stick">
            {/* 닫기 버튼 */}
            <button
              type="button"
              onClick={() => setIsSheetModalOpen(false)}
              className="absolute top-4 right-4 w-9 h-9 bg-[#FF7AC6] border-2 border-black rounded-xl font-black text-black shadow-brutal-sm hover:scale-110 transition flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>

            {/* 헤더 */}
            <div className="mb-4 flex items-center justify-between pr-10 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-3xl">📖</span>
                <div>
                  <h2 className="text-2xl font-pop font-extrabold text-black dark:text-white">
                    구글 시트 일기 / 메모 리스트
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-300 font-sans">
                    구글 스프레드시트와 실시간 연동된 일기 목록입니다.
                  </p>
                </div>
              </div>

              {/* 새로고침 버튼 */}
              <button
                type="button"
                onClick={() => fetchSheetData(true)}
                disabled={isSyncing}
                className="px-3 py-1.5 bg-[#FFE600] text-black border-2 border-black rounded-xl font-pop text-xs font-bold shadow-brutal-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className={isSyncing ? "animate-spin" : ""}>🔄</span>
                <span>{isSyncing ? "불러오는 중..." : "새로고침"}</span>
              </button>
            </div>

            {/* 일기 리스트 목록 */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isSyncing && sheetLogs.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="inline-block text-4xl animate-bounce mb-2">📊</div>
                  <p className="font-pop text-lg text-stone-600 dark:text-stone-300">
                    구글 시트에서 일기를 불러오고 있습니다...
                  </p>
                </div>
              ) : sheetLogs.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-black rounded-2xl p-6">
                  <p className="font-pop text-xl text-stone-600 dark:text-stone-300">
                    구글 시트에 저장된 일기가 없습니다.
                  </p>
                  <p className="text-xs text-stone-400 mt-1">새로운 일기를 작성하고 [저장]을 눌러보세요!</p>
                </div>
              ) : (
                sheetLogs.map((item, idx) => (
                  <div
                    key={item.timestamp || idx}
                    className="p-4 bg-[#FFFEEF] dark:bg-zinc-800 border-2 border-black rounded-2xl shadow-brutal-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 bg-black text-[#FFE600] rounded-md text-[10px] font-pop font-bold">
                          {item.category || "메모"}
                        </span>
                        <span className="text-xs text-stone-500 dark:text-stone-400 font-sans">
                          🕒 {item.datetime || "일시 없음"}
                        </span>
                        {item.state === "completed" && (
                          <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded text-[10px] font-bold">
                            완료
                          </span>
                        )}
                      </div>
                      <p className="font-pop text-base md:text-lg text-black dark:text-zinc-100 break-words whitespace-pre-wrap">
                        {item.content}
                      </p>
                    </div>

                    {/* 액션 버튼: 시트 행 즉시 삭제 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(String(item.timestamp))}
                        className="px-2.5 py-1 bg-white hover:bg-black hover:text-white text-black border-2 border-black rounded-xl text-xs font-pop font-bold shadow-brutal-sm transition cursor-pointer"
                        title="구글 시트에서 즉시 삭제"
                      >
                        ✕ 삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="mt-4 pt-3 border-t-2 border-black border-dashed flex items-center justify-between text-xs font-pop">
              <span className="text-stone-600 dark:text-stone-300">총 {sheetLogs.length}개의 구글 시트 일기</span>
              <button
                type="button"
                onClick={() => setIsSheetModalOpen(false)}
                className="px-4 py-1.5 bg-[#FFE600] text-black border-2 border-black rounded-xl font-bold shadow-brutal-sm cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

