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

type ServerMessage = string;

type JoinMessage = {
  type: "join";
  name: string;
  room: string;
};

type ChatMessage = {
  type: "message";
  text: string;
  room: string;
};

type LeaveMessage = {
  type: "leave";
  name: string;
  room: string;
};

type AnyMessage = JoinMessage | ChatMessage | LeaveMessage | ServerMessage;

type RoomOption = {
  name: string;
  id: string;
};

const roomOptions: RoomOption[] = [
  { name: "Sports", id: "1" },
  { name: "Entertainment", id: "2" },
  { name: "Music", id: "3" },
  { name: "Movies", id: "4" },
  { name: "Tech", id: "5" },
  { name: "Gaming", id: "6" },
  { name: "Travel", id: "7" },
  { name: "Food", id: "8" },
  { name: "Books", id: "9" },
  { name: "Science", id: "10" },
];

export default function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [name, setName] = useState<string>("");
  const [room, setRoom] = useState<string>("");
  const [connected, setConnected] = useState<boolean>(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const messageRef = useRef<HTMLInputElement>(null);

  const connect = () => {
    if (!name) return;

    setRoom(selectedRoom);
    setShowModal(false);

    const socket = new WebSocket("ws://localhost:2000");
    setWs(socket);

    socket.onopen = () => {
      setConnected(true);
      const joinMsg: JoinMessage = { type: "join", name, room: selectedRoom };
      socket.send(JSON.stringify(joinMsg));
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        const data: AnyMessage = JSON.parse(event.data);
        if (
          typeof data === "object" &&
          "room" in data &&
          data.room !== selectedRoom
        )
          return;

        if (typeof data === "object" && "type" in data) {
          if (data.type === "join") {
            setMessages((prev) => [
              ...prev,
              `${data.name} joined room ${data.room}`,
            ]);
          } else if (data.type === "leave") {
            setMessages((prev) => [
              ...prev,
              `${data.name} left room ${data.room}`,
            ]);
          } else if (data.type === "message") {
            setMessages((prev) => [...prev, `[${data.name}]: ${data.text}`]);
          }
        } else {
          setMessages((prev) => [...prev, String(data)]);
        }
      } catch {
        setMessages((prev) => [...prev, event.data]);
      }
    };

    socket.onclose = () => {
      setConnected(false);
    };
  };

  const sendMessage = () => {
    if (ws && messageRef.current?.value) {
      const msg: ChatMessage = {
        type: "message",
        text: messageRef.current.value,
        room,
      };
      ws.send(JSON.stringify(msg));
      messageRef.current.value = "";
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      {!connected ? (
        <div className="w-full max-w-3xl">
          <h2 className="text-3xl font-bold mb-6 text-center">Select a Room</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {roomOptions.map((r) => (
              <div
                key={r.id}
                onClick={() => {
                  setSelectedRoom(r.id);
                  setShowModal(true);
                }}
                className="bg-white p-6 rounded-lg shadow hover:bg-blue-100 cursor-pointer text-center font-semibold"
              >
                {r.name}
              </div>
            ))}
          </div>

          <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogContent className="bg-white">
              <DialogHeader>
                <DialogTitle>Enter your name</DialogTitle>
              </DialogHeader>
              <Input
                placeholder="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mb-4"
              />
              <DialogFooter className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button onClick={connect}>Join</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <div className="w-full max-w-3xl flex flex-col h-[80vh] bg-white rounded shadow">
          {/* Header */}
          <div className="flex justify-between items-center bg-blue-500 text-white p-4 rounded-t">
            <h2 className="text-lg font-bold">
              {roomOptions.find((r) => r.id === room)?.name} Room
            </h2>
            <Button variant="destructive" onClick={goBack}>
              Back
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-100">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`p-2 rounded max-w-[80%] ${
                  msg.startsWith(`[${name}]`)
                    ? "bg-blue-200 ml-auto"
                    : "bg-gray-200"
                }`}
              >
                {msg}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex p-4 gap-2 border-t border-gray-300">
            <Input
              ref={messageRef}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button onClick={sendMessage}>Send</Button>
          </div>
        </div>
      )}
    </div>
  );
}
