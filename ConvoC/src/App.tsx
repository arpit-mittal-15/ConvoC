import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowBigLeft,
  ArrowLeft,
  ArrowLeftIcon,
  ChevronLeft,
  ChevronRight,
  FlagTriangleLeft,
  LogOut,
  LucideArrowLeft,
  Send,
  Users,
} from "lucide-react";

type JoinMessage = {
  type: "join";
  name: string;
  room: string;
  numbers: number[];
};

type ChatMessage = {
  type: "message";
  text: string;
  name?: string;
  room: string;
  numbers?: number[];
};

type LeaveMessage = {
  type: "leave";
  name: string;
  room: string;
  numbers?: number[];
};

type AnyMessage = JoinMessage | ChatMessage | LeaveMessage | string;

type RoomOption = {
  name: string;
  id: string;
  template: string;
};

const roomOptions: RoomOption[] = [
  { name: "Sports", id: "1", template: "sports-template.jpg" },
  { name: "Entertainment", id: "2", template: "entertainment-template.jpg" },
  { name: "Music", id: "3", template: "music-template.jpg" },
  { name: "Movies", id: "4", template: "movies-template.jpg" },
  { name: "Tech", id: "5", template: "tech-template.jpg" },
  { name: "Gaming", id: "6", template: "gaming-template.jpg" },
  { name: "Travel", id: "7", template: "travel-template.jpg" },
  { name: "Food", id: "8", template: "food-template.jpg" },
  { name: "Books", id: "9", template: "books-template.jpg" },
  { name: "Plants", id: "10", template: "plants-template.jpg" },
];

export default function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [name, setName] = useState<string>("");
  const [room, setRoom] = useState<string>("");
  const [connected, setConnected] = useState<boolean>(false);
  const [messages, setMessages] = useState<AnyMessage[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [numbers, setNumbers] = useState<number[]>([0, 0, 0, 0, 0]);
  const inputRef = useRef<HTMLInputElement>(null);

  const connect = () => {
    if (!name || numbers.some((n) => isNaN(n))) return;

    setRoom(selectedRoom);
    setShowModal(false);

    const socket = new WebSocket("ws://localhost:2000");
    setWs(socket);

    socket.onopen = () => {
      setConnected(true);
      const joinMsg: JoinMessage = {
        type: "join",
        name,
        room: selectedRoom,
        numbers,
      };
      socket.send(JSON.stringify(joinMsg));
    };

    socket.onmessage = (event: MessageEvent) => {
      let parsed: any = null;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        const match = event.data.match(/^\[(.*?)\]:\s*(\{.*\})$/);
        if (match) {
          try {
            parsed = { ...JSON.parse(match[2]), name: match[1] };
          } catch {
            parsed = null;
          }
        }
      }

      if (parsed && parsed.room === selectedRoom) {
        console.log("parsed:", parsed);
        setMessages((prev) => [...prev, parsed]);
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };
  };

  const sendMessage = () => {
    if (ws && inputRef.current?.value.trim()) {
      const msg: ChatMessage = {
        type: "message",
        text: inputRef.current.value,
        room,
        name,
        numbers,
      };
      ws.send(JSON.stringify(msg));
      inputRef.current.value = "";
    }
  };

  const goBack = () => {
    ws?.close();
    setConnected(false);
    setMessages([]);
    setWs(null);
    setName("");
    setRoom("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-[url(../public/background.jpg)] bg-cover flex flex-col items-center p-4">
      <div className="h-[15vh] text-white text-4xl font-bold font-display">
        ConvoC
      </div>

      {!connected ? (
        <div className="w-full">
          <h2 className="text-3xl font-bold mb-6 text-center text-white drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]">
            Join your vibe
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {roomOptions.map((r) => (
              <div
                key={r.id}
                onClick={() => {
                  setSelectedRoom(r.id);
                  setShowModal(true);
                }}
                className="h-[30vh] relative p-6 rounded-lg shadow-lg cursor-pointer text-center font-semibold overflow-hidden group transform transition-transform hover:scale-105 flex items-center justify-center"
                style={{
                  backgroundImage: `url(${r.template})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300"></div>
                <div className="font-display relative z-10 text-white text-2xl font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,3)]">
                  {r.name}
                </div>
              </div>
            ))}
          </div>

          <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogContent className="p-0 overflow-hidden max-w-4xl bg-white md:flex md:h-[500px] md:max-w-5xl">
              <div className="hidden md:block md:w-1/2">
                <img
                  src={
                    selectedRoom
                      ? `${roomOptions[Number(selectedRoom) - 1].template}`
                      : ""
                  }
                  alt="Chat Illustration"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="w-full md:w-1/2 p-6 flex flex-col justify-between">
                <div>
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold mb-4">
                      Enter your name
                    </DialogTitle>
                  </DialogHeader>
                  <Input
                    placeholder="Your Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mb-6"
                  />

                  <h3 className="text-2xl font-bold mb-4">
                    Choose your avatar
                  </h3>
                  <div className="flex justify-center items-center mt-10 gap-6">
                    <div className="flex flex-col gap-2">
                      <ChevronLeft
                        onClick={() => {
                          setNumbers((prev) => {
                            const updated = [...prev];
                            updated[1] = (updated[1] - 1 + 27) % 27;
                            return updated;
                          });
                        }}
                      />
                      <ChevronLeft
                        onClick={() => {
                          setNumbers((prev) => {
                            const updated = [...prev];
                            updated[2] = (updated[2] - 1 + 57) % 57;
                            return updated;
                          });
                        }}
                      />
                      <ChevronLeft
                        onClick={() => {
                          setNumbers((prev) => {
                            const updated = [...prev];
                            updated[3] = (updated[3] - 1 + 51) % 51;
                            return updated;
                          });
                        }}
                      />
                    </div>
                    <div className="h-30 w-30 relative">
                      <Avatar arr={numbers} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <ChevronRight
                        onClick={() => {
                          setNumbers((prev) => {
                            const updated = [...prev];
                            updated[1] = (updated[1] + 1) % 27;
                            return updated;
                          });
                        }}
                      />
                      <ChevronRight
                        onClick={() => {
                          setNumbers((prev) => {
                            const updated = [...prev];
                            updated[2] = (updated[2] + 1) % 57;
                            return updated;
                          });
                        }}
                      />
                      <ChevronRight
                        onClick={() => {
                          setNumbers((prev) => {
                            const updated = [...prev];
                            updated[3] = (updated[3] + 1) % 51;
                            return updated;
                          });
                        }}
                      />
                    </div>
                  </div>
                  {/* <div className="grid grid-cols-5 gap-2 mb-6">
                    {numbers.map((num, i) => (
                      <Input
                        key={i}
                        type="number"
                        value={num}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setNumbers((prev) => {
                            const updated = [...prev];
                            updated[i] = val;
                            return updated;
                          });
                        }}
                        className="text-center"
                      />
                    ))}
                  </div> */}
                </div>

                <DialogFooter className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={connect} className="bg-green-500 px-8 text-white">Join</Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="w-full max-w-4xl h-[75vh] flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <h2 className="text-lg font-medium text-gray-900">
                {roomOptions.find((r) => r.id === room)?.name}
              </h2>
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                <Users className="w-3 h-3" /> 3 online
              </span>
            </div>
            <button
              onClick={goBack}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
              Leave
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {messages.map((msg: any, i) => {
              if (!msg || typeof msg !== "object") return null;

              console.log(msg);

              const type = msg.type;
              const sender = msg.name || "";
              const text = msg.text || "";
              const isOwn = sender === name;
              const pfp = msg.pfp || [0,0,0,0,0];

              const avatar = <Avatar arr={pfp} />

              if (type === "join" || type === "leave") {
                return (
                  <div
                    key={i}
                    className="text-center text-gray-500 text-sm italic animate-fade-in"
                  >
                    {type === "join"
                      ? `${sender} joined the room`
                      : `${sender} left the room`}
                  </div>
                );
              }

              if (type === "message") {
                return (
                  <div
                    key={i}
                    className={`flex ${
                      isOwn ? "justify-end" : "justify-start"
                    } animate-fade-in`}
                  >
                    <div
                      className={`flex flex-col ${
                        isOwn ? "items-end" : "items-start"
                      } max-w-[75%]`}
                    >
                      {!isOwn && (
                        <div className="flex text-sm font-medium text-gray-700 mb-1 px-1 gap-2">
                          <div className="h-5 w-5 relative">{avatar}</div>
                          {sender}
                        </div>
                      )}
                      <div
                        className={`ml-8 px-4 py-2.5 rounded-2xl ${
                          isOwn
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-gray-100 text-gray-900 rounded-tl-sm"
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{text}</p>
                      </div>
                      <span className="ml-8 text-xs text-gray-400 mt-1 px-1">
                        {new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Input */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200 bg-white">
            <input
              ref={inputRef}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <button
              title="send"
              onClick={sendMessage}
              className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors shadow-sm hover:shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const Avatar = ({ arr }: { arr: number[] }) => {
  console.log("array: ", arr[1]);

  const colorX = Math.floor(arr[1] % 10);
  const colorY = Math.floor(arr[1] / 10);

  const eyesX = Math.floor(arr[2] % 10);
  const eyesY = Math.floor(arr[2] / 10);

  const mouthX = Math.floor(arr[3] % 10);
  const mouthY = Math.floor(arr[3] / 10);

  console.log(`${colorX * 100}% ${colorY * 100}%`);

  return (
    <>
      <div
        className={`h-full w-full absolute bg-[url(../public/color_atlas.gif)] bg-size-[1000%] `}
        style={{ backgroundPosition: `-${colorX * 100}% -${colorY * 100}%` }}
      />
      <div
        className={`h-full w-full absolute bg-[url(../public/eyes_atlas.gif)] bg-size-[1000%] `}
        style={{ backgroundPosition: `-${eyesX * 100}% -${eyesY * 100}%` }}
      />
      <div
        className="h-full w-full absolute bg-[url(../public/mouth_atlas.gif)] bg-size-[1000%]"
        style={{ backgroundPosition: `-${mouthX * 100}% -${mouthY * 100}%` }}
      />
    </>
  );
};
