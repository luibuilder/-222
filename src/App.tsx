/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, User, Bot, Trophy, Trash2, Loader2, BrainCircuit, ChevronRight } from 'lucide-react';

type Player = 'X' | 'O' | null;

const WIN_PATTERNS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6]             // diagonals
];

interface Scores {
  wins: number;
  losses: number;
  draws: number;
}

export default function App() {
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [xMoves, setXMoves] = useState<number[]>([]);
  const [oMoves, setOMoves] = useState<number[]>([]);
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [winner, setWinner] = useState<{ player: Player; line: number[] | null } | null>(null);
  const [isDraw, setIsDraw] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  
  const [difficulty, setDifficulty] = useState<number>(() => {
    const saved = localStorage.getItem('tic-tac-toe-difficulty');
    return saved ? parseInt(saved, 10) : 3;
  });

  const [scores, setScores] = useState<Scores>(() => {
    const saved = localStorage.getItem('tic-tac-toe-scores');
    return saved ? JSON.parse(saved) : { wins: 0, losses: 0, draws: 0 };
  });

  useEffect(() => {
    localStorage.setItem('tic-tac-toe-difficulty', difficulty.toString());
  }, [difficulty]);

  useEffect(() => {
    localStorage.setItem('tic-tac-toe-scores', JSON.stringify(scores));
  }, [scores]);

  const checkWinner = useCallback((currentBoard: Player[]) => {
    for (const pattern of WIN_PATTERNS) {
      const [a, b, c] = pattern;
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return { player: currentBoard[a], line: pattern };
      }
    }
    const noMoreMoves = currentBoard.every((cell) => cell !== null);
    if (noMoreMoves) return 'DRAW';
    return null;
  }, []);

  const updateScore = useCallback((result: 'X' | 'O' | 'DRAW') => {
    setScores(prev => ({
      ...prev,
      wins: result === 'X' ? prev.wins + 1 : prev.wins,
      losses: result === 'O' ? prev.losses + 1 : prev.losses,
      draws: result === 'DRAW' ? prev.draws + 1 : prev.draws,
    }));
  }, []);

  // Spectator/Predictor Expectimax Minimax
  const minimax = useCallback((
    newBoard: Player[], 
    depth: number, 
    isMaximizing: boolean,
    simXMoves: number[],
    simOMoves: number[]
  ): number => {
    const result = checkWinner(newBoard);
    if (result === 'DRAW') return 0;
    if (result && typeof result !== 'string') return result.player === 'O' ? (10 - depth) : (depth - 10);
    if (depth >= 4) return 0; // Prevent infinite recurrence from looping boards

    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (newBoard[i] === null) {
          const tempBoard = [...newBoard];
          tempBoard[i] = 'O';

          if (simOMoves.length >= 2) {
            const oldest = simOMoves[0];
            tempBoard[oldest] = null;

            const emptyIndices: number[] = [];
            tempBoard.forEach((cell, idx) => {
              if (cell === null) emptyIndices.push(idx);
            });

            if (emptyIndices.length > 0) {
              let scoreSum = 0;
              for (const r of emptyIndices) {
                const relocatedBoard = [...tempBoard];
                relocatedBoard[r] = 'O';
                scoreSum += minimax(relocatedBoard, depth + 1, false, simXMoves, [...simOMoves.slice(1), i, r]);
              }
              bestScore = Math.max(bestScore, scoreSum / emptyIndices.length);
            } else {
              bestScore = Math.max(bestScore, minimax(tempBoard, depth + 1, false, simXMoves, [...simOMoves.slice(1), i]));
            }
          } else {
            bestScore = Math.max(bestScore, minimax(tempBoard, depth + 1, false, simXMoves, [...simOMoves, i]));
          }
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (newBoard[i] === null) {
          const tempBoard = [...newBoard];
          tempBoard[i] = 'X';

          if (simXMoves.length >= 2) {
            const oldest = simXMoves[0];
            tempBoard[oldest] = null;

            const emptyIndices: number[] = [];
            tempBoard.forEach((cell, idx) => {
              if (cell === null) emptyIndices.push(idx);
            });

            if (emptyIndices.length > 0) {
              let scoreSum = 0;
              for (const r of emptyIndices) {
                const relocatedBoard = [...tempBoard];
                relocatedBoard[r] = 'X';
                scoreSum += minimax(relocatedBoard, depth + 1, true, [...simXMoves.slice(1), i, r], simOMoves);
              }
              bestScore = Math.min(bestScore, scoreSum / emptyIndices.length);
            } else {
              bestScore = Math.min(bestScore, minimax(tempBoard, depth + 1, true, [...simXMoves.slice(1), i], simOMoves));
            }
          } else {
            bestScore = Math.min(bestScore, minimax(tempBoard, depth + 1, true, [...simXMoves, i], simOMoves));
          }
        }
      }
      return bestScore;
    }
  }, [checkWinner]);

  const getBestMove = useCallback((currentBoard: Player[]) => {
    let bestScore = -Infinity;
    let move = -1;
    for (let i = 0; i < 9; i++) {
      if (currentBoard[i] === null) {
        const tempBoard = [...currentBoard];
        tempBoard[i] = 'O';

        let score = 0;
        if (oMoves.length >= 2) {
          const oldest = oMoves[0];
          tempBoard[oldest] = null;

          const emptyIndices: number[] = [];
          tempBoard.forEach((cell, idx) => {
            if (cell === null) emptyIndices.push(idx);
          });

          if (emptyIndices.length > 0) {
            let scoreSum = 0;
            for (const r of emptyIndices) {
              const relocatedBoard = [...tempBoard];
              relocatedBoard[r] = 'O';
              scoreSum += minimax(relocatedBoard, 0, false, xMoves, [...oMoves.slice(1), i, r]);
            }
            score = scoreSum / emptyIndices.length;
          } else {
            score = minimax(tempBoard, 0, false, xMoves, [...oMoves.slice(1), i]);
          }
        } else {
          score = minimax(tempBoard, 0, false, xMoves, [...oMoves, i]);
        }

        if (score > bestScore) {
          bestScore = score;
          move = i;
        }
      }
    }
    return move;
  }, [minimax, xMoves, oMoves]);

  const getRandomMove = useCallback((currentBoard: Player[]) => {
    const emptyIndices = currentBoard
      .map((cell, index) => (cell === null ? index : null))
      .filter((val): val is number => val !== null);
    if (emptyIndices.length > 0) {
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }
    return -1;
  }, []);

  const handleAIMove = useCallback(async (currentBoard: Player[]) => {
    setIsThinking(true);
    
    // Aesthetic delay
    await new Promise(resolve => setTimeout(resolve, 600));

    let aiMoveIndex = -1;
    const rand = Math.random();
    
    // Difficulty thresholds
    const difficultyProbabilities = [0, 0.5, 0.7, 0.9, 1.0];
    const useMinimax = rand < difficultyProbabilities[difficulty - 1];

    if (useMinimax) {
      aiMoveIndex = getBestMove([...currentBoard]);
    } else {
      aiMoveIndex = getRandomMove(currentBoard);
    }

    if (aiMoveIndex !== -1) {
      const newBoard = [...currentBoard];
      newBoard[aiMoveIndex] = 'O';

      let updatedOMoves = [...oMoves];
      if (oMoves.length >= 2) {
        const oldestIndex = oMoves[0];
        newBoard[oldestIndex] = null;

        const emptyIndices: number[] = [];
        newBoard.forEach((cell, idx) => {
          if (cell === null) {
            emptyIndices.push(idx);
          }
        });

        if (emptyIndices.length > 0) {
          const randomTarget = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          newBoard[randomTarget] = 'O';
          updatedOMoves = [...oMoves.slice(1), aiMoveIndex, randomTarget];
        } else {
          updatedOMoves = [...oMoves.slice(1), aiMoveIndex];
        }
      } else {
        updatedOMoves = [...oMoves, aiMoveIndex];
      }

      setOMoves(updatedOMoves);
      setBoard(newBoard);
      
      const result = checkWinner(newBoard);
      if (result === 'DRAW') {
        setIsDraw(true);
        updateScore('DRAW');
      } else if (result && typeof result !== 'string') {
        setWinner(result);
        updateScore('O');
      } else {
        setIsXNext(true);
      }
    }
    setIsThinking(false);
  }, [difficulty, getBestMove, getRandomMove, checkWinner, updateScore, oMoves, xMoves]);

  useEffect(() => {
    if (!isXNext && !winner && !isDraw) {
      handleAIMove(board);
    }
  }, [isXNext, winner, isDraw, board, handleAIMove]);

  const handleClick = (index: number) => {
    if (board[index] || winner || isDraw || !isXNext || isThinking) return;

    const newBoard = [...board];
    newBoard[index] = 'X';

    let updatedXMoves = [...xMoves];
    if (xMoves.length >= 2) {
      const oldestIndex = xMoves[0];
      newBoard[oldestIndex] = null;

      const emptyIndices: number[] = [];
      newBoard.forEach((cell, idx) => {
        if (cell === null) {
          emptyIndices.push(idx);
        }
      });

      if (emptyIndices.length > 0) {
        const randomTarget = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        newBoard[randomTarget] = 'X';
        updatedXMoves = [...xMoves.slice(1), index, randomTarget];
      } else {
        updatedXMoves = [...xMoves.slice(1), index];
      }
    } else {
      updatedXMoves = [...xMoves, index];
    }

    setXMoves(updatedXMoves);
    setBoard(newBoard);

    const result = checkWinner(newBoard);
    if (result === 'DRAW') {
      setIsDraw(true);
      updateScore('DRAW');
    } else if (result && typeof result !== 'string') {
      setWinner(result);
      updateScore('X');
    } else {
      setIsXNext(false);
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setXMoves([]);
    setOMoves([]);
    setIsXNext(true);
    setWinner(null);
    setIsDraw(false);
    setIsThinking(false);
  };

  const resetScores = () => {
    setScores({ wins: 0, losses: 0, draws: 0 });
  };

  const getStatus = () => {
    if (isThinking) return '🤔 AI가 수 읽기 중...';
    if (winner) return winner.player === 'X' ? '🎉 당신의 승리!' : '🤖 AI 승리!';
    if (isDraw) return '🤝 무승부';
    return isXNext ? '✋ 당신의 차례' : '🤖 AI 차례';
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center py-12 px-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl flex flex-col items-center"
      >
        <h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-pink-500 text-center">
          NEON TIC-TAC-TOE
        </h1>
        <p className="text-slate-400 mb-6 text-sm font-mono tracking-widest uppercase">Minimax AI Engine</p>

        {/* Chaos Rule Notice */}
        <div className="w-full max-w-md bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6 backdrop-blur-md flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold animate-bounce text-sm">
            ⚡
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">카오스 룰 적용 중</h4>
            <p className="text-[11px] text-slate-350 leading-relaxed font-medium">
              3번째 말을 놓을 때, 가장 먼저 놓았던 말이 <span className="text-amber-400 font-black underline">무작위 빈 칸</span>으로 텔레포트합니다!
            </p>
          </div>
        </div>

        {/* Difficulty Selector */}
        <div className="w-full max-w-md bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 mb-8 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-slate-300">
              <BrainCircuit size={18} className="text-indigo-400" />
              <span className="text-sm font-bold uppercase tracking-tight">AI 난이도</span>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
              Lv.{difficulty}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={difficulty}
            onChange={(e) => setDifficulty(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between mt-2 px-1">
            <span className="text-[10px] text-slate-500 font-bold">쉬움</span>
            <span className="text-[10px] text-slate-500 font-bold">천하무적</span>
          </div>
        </div>

        <div className="flex flex-col gap-8 w-full max-w-md items-center">
          {/* Game Board Column */}
          <div className="flex flex-col items-center w-full">
            {/* Status Message */}
            <div className="h-10 mb-4 font-semibold text-lg flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={getStatus()}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center gap-2"
                >
                  {isThinking && <Loader2 size={20} className="animate-spin text-indigo-400" />}
                  <span className={winner ? "text-green-400" : isDraw ? "text-slate-400" : "text-slate-200"}>
                    {getStatus()}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Grid */}
            <div 
              className="grid grid-cols-3 gap-3 bg-slate-800/80 p-3 rounded-2xl border-4 border-slate-700/50 shadow-2xl overflow-hidden relative" 
              id="game-board"
            >
              {board.map((cell, i) => {
                const isXOldest = xMoves.length >= 2 && xMoves[0] === i;
                const isOOldest = oMoves.length >= 2 && oMoves[0] === i;
                const isOldest = isXOldest || isOOldest;

                return (
                  <motion.button
                    key={i}
                    whileHover={!cell && !winner && !isDraw && isXNext && !isThinking ? { scale: 0.95, backgroundColor: 'rgba(51, 65, 85, 1)' } : {}}
                    whileTap={!cell && !winner && !isDraw && isXNext && !isThinking? { scale: 0.9 } : {}}
                    onClick={() => handleClick(i)}
                    disabled={!!cell || !!winner || isDraw || !isXNext || isThinking}
                    className={`
                      w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-xl text-4xl font-black transition-all duration-300 relative
                      ${cell === null ? 'bg-slate-700/50 cursor-pointer' : 'bg-slate-700 cursor-default'}
                      ${winner?.line?.includes(i) ? 'bg-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.3)] border-2 border-green-500/50' : 
                        isOldest ? 'border-2 border-dashed border-amber-500/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]' : 'border border-slate-600/30'}
                    `}
                    id={`cell-${i}`}
                  >
                    <AnimatePresence>
                      {cell && (
                        <motion.span
                          initial={{ scale: 0, rotate: -45, opacity: 0 }}
                          animate={{ scale: 1, rotate: 0, opacity: 1 }}
                          className={`${cell === 'X' ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-pink-400 drop-shadow-[0_0_8px_rgba(244,114,182,0.5)]'}`}
                        >
                          {cell}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {isOldest && cell && (
                      <span className="absolute bottom-1 right-1 text-[8px] font-black text-amber-400 bg-amber-500/10 px-1 rounded uppercase tracking-tighter">
                        이동 예정
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Main Action */}
            <div className="mt-8">
              <button
                onClick={resetGame}
                className="flex items-center gap-2 bg-slate-100 hover:bg-white text-slate-900 font-bold px-10 py-3 rounded-xl transition-all shadow-xl active:scale-95 group"
                id="reset-button"
              >
                <RefreshCw size={18} className="group-active:rotate-180 transition-transform duration-500" />
                다시 시작
              </button>
            </div>
          </div>

          {/* Score & Info Column */}
          <div className="flex flex-col gap-6 w-full">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-6 border-b border-slate-700/50 pb-3">
                <Trophy size={20} className="text-yellow-500" />
                <h3 className="font-black text-sm tracking-widest uppercase">SCOREBOARD</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/30">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-blue-400 rounded-full" />
                    <span className="text-xs text-slate-400 font-bold tracking-tight uppercase">USER (X)</span>
                  </div>
                  <span className="text-2xl font-black text-blue-400 font-mono">{scores.wins}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/30">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-pink-400 rounded-full" />
                    <span className="text-xs text-slate-400 font-bold tracking-tight uppercase">AI (O)</span>
                  </div>
                  <span className="text-2xl font-black text-pink-400 font-mono">{scores.losses}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/30">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-slate-400 rounded-full" />
                    <span className="text-xs text-slate-400 font-bold tracking-tight uppercase">DRAW</span>
                  </div>
                  <span className="text-2xl font-black text-slate-300 font-mono">{scores.draws}</span>
                </div>
              </div>

              <button
                onClick={resetScores}
                className="w-full mt-6 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest"
              >
                <Trash2 size={12} />
                점수판 초기화
              </button>
            </div>

            <div className="flex items-center justify-center gap-8 bg-slate-800/20 py-4 px-6 rounded-2xl border border-slate-700/30">
              <div className={`flex flex-col items-center gap-1 transition-opacity duration-300 ${isXNext ? 'opacity-100' : 'opacity-30'}`}>
                <User size={24} className="text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-tighter">Player</span>
              </div>
              <div className="h-8 w-px bg-slate-700" />
              <div className={`flex flex-col items-center gap-1 transition-opacity duration-300 ${!isXNext ? 'opacity-100' : 'opacity-30'}`}>
                <Bot size={24} className="text-pink-400" />
                <span className="text-[10px] font-black uppercase tracking-tighter">AI</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 text-slate-600 text-[10px] font-mono uppercase tracking-[0.2em] flex flex-col items-center gap-2">
           <div>&copy; 2024 NEON GRID v3.0</div>
           <div className="text-slate-700">— LOCAL INTELLIGENCE ACTIVE —</div>
        </footer>
      </motion.div>
    </div>
  );
}

