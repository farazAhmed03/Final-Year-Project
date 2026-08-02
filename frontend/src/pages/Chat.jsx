import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  useNavigate,
  useParams
} from "react-router-dom";
import {
  FiMessageCircle,
  FiSend
} from "react-icons/fi";
import { toast } from "react-toastify";
import api, {
  apiErrorMessage
} from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import {
  Avatar,
  EmptyState,
  ErrorState,
  Loader,
  PageHeader
} from "../components/UI";
import { formatDate } from "../utils/format";
import { otherParticipant } from "../utils/roles";

function appendUnique(current, message) {
  return current.some((item) => item._id === message._id)
    ? current
    : [...current, message];
}

export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [typingName, setTypingName] = useState("");

  const endRef = useRef(null);
  const typingTimer = useRef(null);

  const loadConversations = useCallback(async () => {
    setError("");
    setLoadingConversations(true);

    try {
      const response = await api.get("/conversations");
      setConversations(response.data.data.items);
    } catch (requestError) {
      setError(apiErrorMessage(requestError));
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);

    try {
      const response = await api.get(
        `/conversations/${conversationId}/messages`,
        { params: { limit: 100 } }
      );

      setMessages(response.data.data.items);
      await api.patch(
        `/conversations/${conversationId}/read`
      );

      setConversations((items) =>
        items.map((item) =>
          item._id === conversationId
            ? { ...item, unreadCount: 0 }
            : item
        )
      );
    } catch (requestError) {
      toast.error(apiErrorMessage(requestError));
      navigate("/app/chat", { replace: true });
    } finally {
      setLoadingMessages(false);
    }
  }, [conversationId, navigate]);

  useEffect(() => {
    loadConversations();

    const refresh = () => loadConversations();

    window.addEventListener(
      "legalsphere:notification",
      refresh
    );

    return () => {
      window.removeEventListener(
        "legalsphere:notification",
        refresh
      );
    };
  }, [loadConversations]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!socket || !conversationId) {
      return undefined;
    }

    socket.emit(
      "conversation:join",
      { conversationId }
    );

    const onMessage = (message) => {
      const sourceConversation = message.conversation?._id
        || message.conversation;

      if (sourceConversation === conversationId) {
        setMessages((items) =>
          appendUnique(items, message)
        );

        if (message.sender?._id !== user._id) {
          api.patch(
            `/conversations/${conversationId}/read`
          ).catch(() => {});
        }
      }

      loadConversations();
    };

    const onTyping = ({
      conversationId: source,
      userId,
      typing
    }) => {
      if (
        source !== conversationId ||
        userId === user._id
      ) {
        return;
      }

      const selected = conversations.find(
        (item) => item._id === conversationId
      );

      setTypingName(
        typing
          ? otherParticipant(selected, user._id)?.name
            || "Someone"
          : ""
      );
    };

    socket.on("message:new", onMessage);
    socket.on("typing:update", onTyping);

    return () => {
      socket.emit(
        "conversation:leave",
        { conversationId }
      );
      socket.off("message:new", onMessage);
      socket.off("typing:update", onTyping);
    };
  }, [
    socket,
    conversationId,
    user._id,
    conversations,
    loadConversations
  ]);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [messages, typingName]);

  const send = async (event) => {
    event.preventDefault();

    const body = draft.trim();

    if (!body || !conversationId) {
      return;
    }

    setDraft("");
    setSending(true);

    socket?.emit(
      "typing:stop",
      { conversationId }
    );

    try {
      const response = await api.post(
        `/conversations/${conversationId}/messages`,
        { body }
      );

      setMessages((items) =>
        appendUnique(
          items,
          response.data.data.message
        )
      );

      await loadConversations();
    } catch (requestError) {
      setDraft(body);
      toast.error(apiErrorMessage(requestError));
    } finally {
      setSending(false);
    }
  };

  const onDraft = (event) => {
    setDraft(event.target.value);

    if (!socket || !conversationId) {
      return;
    }

    socket.emit(
      "typing:start",
      { conversationId }
    );

    window.clearTimeout(typingTimer.current);

    typingTimer.current = window.setTimeout(() => {
      socket.emit(
        "typing:stop",
        { conversationId }
      );
    }, 900);
  };

  const selected = conversations.find(
    (item) => item._id === conversationId
  );

  const counterpart = otherParticipant(
    selected,
    user._id
  );

  return (
    <>
      <PageHeader
        eyebrow="Secure communication"
        title="Messages"
        description={`Real-time connection: ${connected ? "online" : "reconnecting"}. Messaging unlocks after appointment confirmation.`}
      />

      {error && (
        <ErrorState
          message={error}
          onRetry={loadConversations}
        />
      )}

      <section
        className={`chat-layout ${conversationId ? "has-selection" : ""}`}
      >
        <aside className="conversation-panel">
          <header>
            <h2>Conversations</h2>
            <span>{conversations.length}</span>
          </header>

          {loadingConversations ? (
            <Loader label="Loading conversations…" />
          ) : conversations.length ? (
            <div className="conversation-list">
              {conversations.map((conversation) => {
                const person = otherParticipant(
                  conversation,
                  user._id
                );

                return (
                  <button
                    key={conversation._id}
                    className={
                      conversation._id === conversationId
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      navigate(
                        `/app/chat/${conversation._id}`
                      )
                    }
                  >
                    <Avatar user={person} />

                    <div>
                      <strong>
                        {person?.name || "Conversation"}
                      </strong>
                      <small>
                        {conversation.lastMessagePreview
                          || "Start your shared conversation"}
                      </small>
                    </div>

                    {conversation.unreadCount > 0 && (
                      <span className="unread-pill">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No conversations"
              description="A single shared conversation appears here after a lawyer confirms an appointment."
            />
          )}
        </aside>

        <article className="message-panel">
          {!conversationId ? (
            <EmptyState
              title="Choose a conversation"
              description="Each client and lawyer share one conversation across appointments and cases."
              action={
                <FiMessageCircle className="empty-large-icon" />
              }
            />
          ) : (
            <>
              <header className="message-header">
                <Avatar user={counterpart} />
                <div>
                  <strong>{counterpart?.name}</strong>
                  <small>
                    {counterpart?.lawyerProfile?.specialization
                      || counterpart?.role}
                  </small>
                </div>
              </header>

              <div className="message-scroll">
                {loadingMessages ? (
                  <Loader label="Loading messages…" />
                ) : (
                  messages.map((message) => {
                    const mine = (
                      message.sender?._id
                      || message.sender
                    ) === user._id;

                    return (
                      <div
                        className={`message-bubble-wrap ${mine ? "mine" : ""}`}
                        key={message._id}
                      >
                        {!mine && (
                          <Avatar
                            user={message.sender}
                            size="sm"
                          />
                        )}

                        <div className="message-bubble">
                          <p>{message.body}</p>
                          <small>
                            {formatDate(message.createdAt)}
                          </small>
                        </div>
                      </div>
                    );
                  })
                )}

                {typingName && (
                  <div className="typing-indicator">
                    {typingName} is typing
                    <span>•••</span>
                  </div>
                )}

                <div ref={endRef} />
              </div>

              <form
                className="message-composer"
                onSubmit={send}
              >
                <textarea
                  rows="1"
                  maxLength="4000"
                  placeholder="Write a secure message…"
                  value={draft}
                  onChange={onDraft}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      send(event);
                    }
                  }}
                />

                <button
                  className="btn btn-brand"
                  disabled={sending || !draft.trim()}
                  aria-label="Send message"
                >
                  <FiSend />
                </button>
              </form>
            </>
          )}
        </article>
      </section>
    </>
  );
}
