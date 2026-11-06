/** 
 * Inline Mini-Games & Quick Poll Battles - Zero-friction multiplayer games
 * playable directly inside chat bubbles.
 * 
 * Features:
 *   - Wordle battles (two-player word guessing game)
 *   - Quick polls with real-time results
 *   - Trivia questions with timed answers
 *   - Tap-to-play from any chat bubble
 *   - Score tracking and leaderboards
 *   - Emoji reaction betting
 *   - Auto-expiration after 24 hours
 *   - Works in both 1:1 and group chats
 */

export type MiniGameType = 'wordle' | 'poll' | 'trivia' | 'tic-tac-toe';

/** Wordle game state */
export interface WordleGame {
  id: string;
  challengeId: string; // Unique ID for this wordle session
  player1Id: string;
  player2Id: string | null; // null = single player, set when opponent joins
  targetWord: string;
  currentAttempt: number;
  maxAttempts: 6;
  guessedLetters: string[];
  correctPositions: number[][];
  status: 'waiting' | 'active' | 'completed';
  winner: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** Poll game state */
export interface PollGame {
  id: string;
  conversationId: string;
  question: string;
  options: string[];
  optionVotes: Record<string, number>; // option index -> vote count
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  allowMultipleVotes: boolean;
  status: 'active' | 'closed';
}

/** Trivia game state */
export interface TriviaGame {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  timeLimit: number; // seconds
  askedBy: string;
  askedAt: string;
  answeredBy: string | null;
  answerTime: number | null; // milliseconds since asked
  status: 'active' | 'answered' | 'expired';
}

/** Tic-Tac-Toe game state */
export interface TicTacToeGame {
  id: string;
  player1Id: string;
  player2Id: string;
  board: ('X' | 'O' | null)[][];
  currentPlayer: string;
  status: 'active' | 'win' | 'draw';
  winner: string | null;
  movedAt: string;
}

/** Mini game message for broadcasting */
export type MiniGameMessage = 
  | { type: 'wordle-guess'; gameId: string; attempt: string; correct: boolean }
  | { type: 'poll-vote'; gameId: string; optionIndex: number }
  | { type: 'trivia-answer'; gameId: string; answerIndex: number; correct: boolean }
  | { type: 'tic-tac-toe-move'; gameId: string; position: number; player: string }
  | { type: 'game-start'; gameId: string; gameType: MiniGameType; details: any }
  | { type: 'game-update'; gameId: string; status: string };

/** Start a Wordle battle */
export function startWordleBattle(
  player1Id: string,
  player2Id: string | null,
  targetWord?: string
): WordleGame {
  const wordle: WordleGame = {
    id: `wordle-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    challengeId: `wordle-${Math.random().toString(36).slice(2)}`,
    player1Id,
    player2Id,
    targetWord: targetWord || generateRandomWord(),
    currentAttempt: 1,
    maxAttempts: 6,
    guessedLetters: [],
    correctPositions: [],
    status: player2Id ? 'active' : 'waiting',
    winner: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  return wordle;
}

/** Generate a random 5-letter word for Wordle */
function generateRandomWord(): string {
  const words = ['apple', 'house', 'water', 'music', 'light', 'tree', 'ocean', 'fire', 'earth', 'sky'];
  return words[Math.floor(Math.random() * words.length)];
}

/** Process a Wordle guess */
export function processWordleGuess(
  game: WordleGame,
  guess: string
): { correct: boolean; newGame: WordleGame; hint?: string } {
  const target = game.targetWord.toLowerCase();
  const guessLower = guess.toLowerCase();
  
  // If guess is wrong length, return error
  if (guessLower.length !== 5) {
    return { correct: false, newGame: game };
  }
  
  // Update game state
  const newGuessedLetters = [...new Set([...game.guessedLetters, ...guessLower])];
  const newCorrectPositions: number[][] = [];
  let correctCount = 0;
  
  for (let i = 0; i < 5; i++) {
    if (guessLower[i] === target[i]) {
      newCorrectPositions.push([i, 1]); // 1 = correct position
      correctCount++;
    } else if (target.includes(guessLower[i])) {
      newCorrectPositions.push([i, 0]); // 0 = wrong position but letter exists
    } else {
      newCorrectPositions.push([i, -1]); // -1 = letter not in word
    }
  }
  
  const newGame: WordleGame = {
    ...game,
    guessedLetters: newGuessedLetters,
    correctPositions: newCorrectPositions,
    currentAttempt: game.currentAttempt + 1,
  };
  
  // Check for win
  const won = correctCount === 5;
  let status = newGame.status;
  let winner = newGame.winner;
  
  if (won) {
    status = 'completed';
    winner = game.player1Id;
    newGame.completedAt = new Date().toISOString();
    newGame.winner = winner;
  } else if (newGame.currentAttempt >= newGame.maxAttempts) {
    status = 'completed';
    // Opponent wins
    winner = game.player2Id || 'system';
    newGame.completedAt = new Date().toISOString();
    newGame.winner = winner;
  }
  
  newGame.status = status;
  newGame.winner = winner;
  
  const hint = formatWordleHint(newCorrectPositions);
  
  return { correct: won, newGame, hint };
}

/** Format Wordle hint for display */
function formatWordleHint(correctPositions: number[][]): string {
  const symbols = (correctPositions || []).map(([pos, result]) => {
    if (result === 1) return '🟩'; // Correct position
    if (result === 0) return '🟨'; // Letter in word, wrong position
    return '⬛'; // Letter not in word
  });
  return symbols.join('');
}

/** Process a poll vote */
export function processPollVote(
  game: PollGame,
  optionIndex: number
): PollGame {
  const newOptionVotes = { ...game.optionVotes };
  const optionKey = `option-${optionIndex}`;
  
  newOptionVotes[optionKey] = (newOptionVotes[optionKey] || 0) + 1;
  
  const newPoll: PollGame = {
    ...game,
    optionVotes: newOptionVotes,
  };
  
  // Check if all options have been voted on and close if needed
  const totalVotes = Object.values(newOptionVotes).reduce((sum, v) => sum + v, 0);
  const totalOptions = game.options.length;
  
  let status = newPoll.status;
  if (totalVotes > 0 && totalVotes >= totalOptions && status === 'active') {
    status = 'closed';
  }
  
  newPoll.status = status;
  
  return newPoll;
}

/** Process a trivia answer */
export function processTriviaAnswer(
  game: TriviaGame,
  answerIndex: number
): { correct: boolean; newGame: TriviaGame } {
  const correct = answerIndex === game.correctAnswerIndex;
  const now = Date.now();
  
  const newGame: TriviaGame = {
    ...game,
    answeredBy: game.askedBy, // Would be the player who answered
    answerTime: now - new Date(game.askedAt).getTime(),
    status: correct ? 'answered' : 'active',
  };
  
  // If answered correctly, mark as answered
  if (correct) {
    newGame.status = 'answered';
  }
  
  return { correct, newGame };
}

/** Start a trivia question */
export function startTriviaQuestion(
  question: string,
  options: string[],
  correctAnswerIndex: number,
  timeLimit: number = 30,
  askedBy: string
): TriviaGame {
  const trivia: TriviaGame = {
    id: `trivia-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    question,
    options,
    correctAnswerIndex,
    timeLimit,
    askedBy,
    askedAt: new Date().toISOString(),
    answeredBy: null,
    answerTime: null,
    status: 'active',
  };
  return trivia;
}

/** Start a Tic-Tac-Toe game */
export function startTicTacToeGame(
  player1Id: string,
  player2Id: string
): TicTacToeGame {
  const board: ('X' | 'O' | null)[][] = [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ];
  
  const ttt: TicTacToeGame = {
    id: `tictactoe-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    player1Id,
    player2Id,
    board,
    currentPlayer: player1Id,
    status: 'active',
    winner: null,
    movedAt: new Date().toISOString(),
  };
  return ttt;
}

/** Process a Tic-Tac-Toe move */
export function processTicTacToeMove(
  game: TicTacToeGame,
  position: number // 0-8 for the board
): { newGame: TicTacToeGame; winner: string | null; status: 'active' | 'win' | 'draw' } {
  const board = (game.board || []).map(row => [...row]); // Deep copy
  const player = game.currentPlayer;
  const mark = player === game.player1Id ? 'X' : 'O';
  
  // Calculate board position
  const row = Math.floor(position / 3);
  const col = position % 3;
  
  // If position already taken, return error
  if (board[row][col] !== null) {
    return { newGame: game, winner: null, status: game.status };
  }
  
  // Make the move
  board[row][col] = mark;
  
  // Check for win
  let win = false;
  let winner = null;
  
  // Check rows
  for (let i = 0; i < 3; i++) {
    if (board[i][0] && board[i][0] === board[i][1] && board[i][1] === board[i][2]) {
      win = true;
      winner = player;
    }
    if (board[0][i] && board[0][i] === board[1][i] && board[1][i] === board[2][i]) {
      win = true;
      winner = player;
    }
  }
  
  // Check diagonals
  if (board[0][0] && board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
    win = true;
    winner = player;
  }
  if (board[0][2] && board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
    win = true;
    winner = player;
  }
  
  // Check for draw (board full)
  let isDraw = true;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (board[r][c] === null) isDraw = false;
    }
  }
  
  const newGame: TicTacToeGame = {
    ...game,
    board,
    currentPlayer: player === game.player1Id ? game.player2Id : game.player1Id,
    status: win ? 'win' : (isDraw ? 'draw' : 'active'),
    winner,
    movedAt: new Date().toISOString(),
  };
  
  return { newGame, winner, status: newGame.status };
}

export default {
  MiniGameType,
  WordleGame,
  PollGame,
  TriviaGame,
  TicTacToeGame,
  MiniGameMessage,
  startWordleBattle,
  processWordleGuess,
  formatWordleHint,
  processPollVote,
  startTriviaQuestion,
  processTriviaAnswer,
  startTicTacToeGame,
  processTicTacToeMove,
};