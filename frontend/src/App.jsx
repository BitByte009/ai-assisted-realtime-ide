import './App.css';
import io from 'socket.io-client';
import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import Markdown from 'react-markdown';

const socket = io('https://ai-assisted-realtime-ide.onrender.com/');

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [language, setLanguage] = useState('cpp');
  const [code, setCode] = useState('// start coding here...');
  const [copySuccess, setCopySuccess] = useState('');
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState('');
  const [outPut, setOutput] = useState('');
  const [input, setInput] = useState('');
  const [version, setVersion] = useState('*');
  const [isRev, setIsRev] = useState(false);
  // State for controlling modal visibility and content
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    socket.on('userJoined', (users) => {
      setUsers(users);
    });

    socket.on('codeUpdate', (newCode) => {
      setCode(newCode);
    });

    socket.on('userTyping', (user) => {
      setTyping(`${user.slice(0, 10)} is typing...`);
      setTimeout(() => setTyping(''), 2000);
    });

    socket.on('languageUpdate', (newLanguage) => {
      console.log(newLanguage);
      setLanguage(newLanguage);
    });

    socket.on('codeResponse', (response) => {
      setOutput(response.run.output);
    });

    socket.on('AIReview', (message) => {
      console.log('AI Review:', message);
      setModalMessage(message);
      setIsModalOpen(true);
      setIsRev(false);
    });

    return () => {
      socket.off('userJoined');
      socket.off('codeUpdate');
      socket.off('userTyping');
      socket.off('languageUpdate');
      socket.off('codeResponse');
      socket.off('AIReview');
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      socket.emit('leaveRoom');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const JoinRoom = () => {
    if (roomId && userName) {
      socket.emit('join', { roomId, userName });
      setJoined(true);
    }
  };

  const leaveRoom = () => {
    socket.emit('leaveRoom');
    setJoined(false);
    setRoomId('');
    setUserName('');
    setCode('//start coding here...');
    setLanguage('cpp');
  };

  const generateRoomId = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopySuccess('Copied!');
    setTimeout(() => {
      setCopySuccess('');
    }, 2000);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit('codeChange', { roomId, code: newCode });
    socket.emit('typing', roomId, userName);
  };

  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    socket.emit('languageChange', { roomId, language: newLanguage });
  };

  const runCode = () => {
    socket.emit('compileCode', {
      code,
      roomId,
      language,
      version,
      stdin: input,
    });
  };

  const AIreview = () => {
    setIsRev(true);
    socket.emit('getAIReview', {
      roomId,
      code,
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalMessage('');
  };

  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Join Code Room</h1>
          <input
            type="text"
            placeholder="Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <input
            type="text"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button onClick={handleCreateRoom} style={{ marginBottom: '10px' }}>
            Create Room
          </button>
          <button onClick={JoinRoom}>Join Room</button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="sidebar">
        <div className="room-info">
          <h2>Code Room: {roomId}</h2>
          <button onClick={copyRoomId} className="copy-button">
            Copy Id
          </button>
          {copySuccess && <span className="copy-success">{copySuccess}</span>}
        </div>
        <h3>Users in Room:</h3>
        <ul>
          {users.map((user, index) => (
            <li key={index}>{user}</li>
          ))}
        </ul>
        <p className="typing-indicator">{typing}</p>
        <select
          className="language-selector"
          value={language}
          onChange={handleLanguageChange}
        >
          <option value="cpp">C++</option>
          <option value="javascript">JavaScript</option>
          <option value="python3">Python</option>
          <option value="java">Java</option>
        </select>
        <button className="leave-button" onClick={leaveRoom}>
          Leave Room
        </button>
        <button
          className="ai-review-button"
          onClick={AIreview}
          disabled={isRev}
        >
          {!isRev ? 'AI Review' : 'isReviewing...'}
        </button>
      </div>
      <div className="main-panel">
        <div className="editor-wrapper">
          <Editor
            height="100%"
            defaultLanguage={language}
            language={language}
            value={code}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
            }}
          />
        </div>
        <div className="bottom-panel">
          <textarea
            className="output-console"
            value={outPut}
            readOnly
            placeholder="Output will be displayed here..."
          />
          <div className="input-wrapper">
            <textarea
              className="input-box"
              placeholder="Input goes here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="execute-btn" onClick={runCode}>
              Execute
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>AI Review</h2>
            <pre><Markdown>{modalMessage}</Markdown></pre>
            <div className="modal-actions">
              <button onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );  
};

export default App;