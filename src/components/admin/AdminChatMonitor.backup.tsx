import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useSchool } from '../../context/SchoolContext';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Search, Eye, Loader2, Send, ShieldCheck, User, ChevronLeft } from 'lucide-react';

interface Conversation {
    chatId: string;
    parentName: string;
    parentId: string;
    teacherName: string;
    teacherId: string;
    studentClass?: string;
    lastMessage?: string;
    lastMessageTime?: any;
    messageCount: number;
}

interface Message {
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    createdAt: any;
    isFromParent?: boolean;
    isAdmin?: boolean;
}

const AdminChatMonitor: React.FC = () => {
    const { user } = useAuth();
    const { currentSchool } = useSchool();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBy, setFilterBy] = useState<'ALL' | 'TEACHER' | 'PARENT'>('ALL');
    const [adminReply, setAdminReply] = useState('');
    const [sending, setSending] = useState(false);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    // Fetch all conversations
    useEffect(() => {
        if (!currentSchool?.id) return;

        const fetchConversations = async () => {
            setLoading(true);
            try {
                const msgsRef = collection(db, 'messages');
                const q = query(msgsRef, where('schoolId', '==', currentSchool.id));
                const snapshot = await getDocs(q);

                const convMap = new Map<string, Conversation>();

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const chatId = data.chatId;

                    if (!convMap.has(chatId)) {
                        convMap.set(chatId, {
                            chatId,
                            parentName: data.isFromParent ? data.senderName : data.receiverName,
                            parentId: data.isFromParent ? data.senderId : data.receiverId,
                            teacherName: data.isFromParent ? data.receiverName : data.senderName,
                            teacherId: data.isFromParent ? data.receiverId : data.senderId,
                            studentClass: data.parentClass,
                            lastMessage: data.text,
                            lastMessageTime: data.createdAt,
                            messageCount: 1
                        });
                    } else {
                        const conv = convMap.get(chatId)!;
                        conv.messageCount++;
                        if (data.createdAt?.seconds > (conv.lastMessageTime?.seconds || 0)) {
                            conv.lastMessage = data.text;
                            conv.lastMessageTime = data.createdAt;
                        }
                    }
                });

                const convArray = Array.from(convMap.values());
                convArray.sort((a, b) => (b.lastMessageTime?.seconds || 0) - (a.lastMessageTime?.seconds || 0));
                setConversations(convArray);
            } catch (error) {
                console.error('Error fetching conversations:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchConversations();
    }, [currentSchool?.id]);

    // Subscribe to messages for selected conversation
    useEffect(() => {
        if (!selectedConversation || !currentSchool?.id) {
            setMessages([]);
            return;
        }

        const msgsRef = collection(db, 'messages');
        const q = query(
            msgsRef,
            where('chatId', '==', selectedConversation.chatId),
            where('schoolId', '==', currentSchool.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
            newMsgs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            setMessages(newMsgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });

        return () => unsubscribe();
    }, [selectedConversation, currentSchool?.id]);

    const handleSendAdminMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminReply.trim() || !user?.id || !selectedConversation || sending) return;

        setSending(true);
        try {
            await addDoc(collection(db, 'messages'), {
                chatId: selectedConversation.chatId,
                senderId: user.id || 'admin',
                senderName: user.name || user.username || 'System Admin',
                receiverId: 'multiple',
                receiverName: 'Monitored Conversation',
                text: adminReply.trim(),
                createdAt: Timestamp.now(),
                isFromParent: false,
                isAdmin: true,
                schoolId: currentSchool?.id
            });
            setAdminReply('');
        } catch (error) {
            console.error('Error sending admin message:', error);
        } finally {
            setSending(false);
        }
    };

    const filteredConversations = conversations.filter(conv => {
        const matchesSearch = searchTerm === '' ||
            conv.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            conv.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (conv.studentClass?.toLowerCase().includes(searchTerm.toLowerCase()));

        if (filterBy === 'TEACHER') return conv.teacherName.toLowerCase().includes(searchTerm.toLowerCase());
        if (filterBy === 'PARENT') return conv.parentName.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    if (loading) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
                <Loader2 className="animate-spin" size={40} color="var(--primary)" style={{ margin: '0 auto' }} />
                <p style={{ marginTop: '1rem', fontWeight: 600, color: '#64748b' }}>Loading conversations...</p>
            </div>
        );
    }

    return (
        <div className="admin-chat-monitor-root">
            <div className="admin-monitor-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="header-badge">ADMIN</div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>Communication Monitor</h2>
                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>
                            Professional Monitoring & Official Responses
                            {selectedConversation && ` • Selected: ${selectedConversation.parentName}`}
                        </p>
                    </div>
                </div>
            </div>

            <div className="admin-monitor-body">
                {/* Sidebar */}
                <div
                    className={`monitor-sidebar ${selectedConversation ? 'hide-mobile' : ''}`}
                    style={{
                        ...(window.innerWidth <= 768 && selectedConversation && { display: 'none' })
                    }}
                >
                    <div className="sidebar-search">
                        <div className="search-box">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="sidebar-list">
                        {filteredConversations.map(conv => (
                            <div
                                key={conv.chatId}
                                onClick={() => setSelectedConversation(conv)}
                                className={`conv-item ${selectedConversation?.chatId === conv.chatId ? 'active' : ''}`}
                                style={{ position: 'relative', zIndex: 10, cursor: 'pointer' }}
                            >
                                <div className="conv-item-top">
                                    <span className="conv-title">{conv.parentName}</span>
                                    <span className="conv-count">{conv.messageCount}</span>
                                </div>
                                <div className="conv-item-sub">↔ {conv.teacherName}</div>
                                {conv.studentClass && <div className="conv-item-tag">Class {conv.studentClass}</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div
                    className={`monitor-chat-main ${!selectedConversation ? 'hide-mobile' : ''}`}
                    style={{
                        ...(window.innerWidth <= 768 && !selectedConversation && { display: 'none' })
                    }}
                >
                    {selectedConversation ? (
                        <div className="chat-container">
                            <div className="chat-view-header">
                                <button className="back-btn-mobile" onClick={() => setSelectedConversation(null)}>
                                    <ChevronLeft size={24} />
                                </button>
                                <div className="header-avatar"><User size={20} /></div>
                                <div>
                                    <h4 style={{ margin: 0, fontWeight: 900 }}>{selectedConversation.parentName} & {selectedConversation.teacherName}</h4>
                                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>{selectedConversation.studentClass ? `CLASS ${selectedConversation.studentClass}` : 'CONVERSATION'}</p>
                                </div>
                            </div>

                            <div className="chat-messages-area">
                                {messages.map((msg) => (
                                    <div key={msg.id} className={`chat-msg-row ${msg.isFromParent ? 'left' : 'right'}`}>
                                        <div className="chat-msg-meta">
                                            {msg.isAdmin && <ShieldCheck size={12} />}
                                            {msg.senderName} {msg.isAdmin ? '(Admin)' : msg.isFromParent ? '(Parent)' : '(Teacher)'}
                                        </div>
                                        <div className={`chat-msg-bubble ${msg.isAdmin ? 'admin' : (msg.isFromParent ? 'parent' : 'teacher')}`}>
                                            <p>{msg.text}</p>
                                            <span className="chat-msg-time">
                                                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                <div ref={scrollRef} />
                            </div>

                            {/* REPLY BOX - ABSOLUTELY ESSENTIAL */}
                            <div className="chat-reply-container">
                                <form onSubmit={handleSendAdminMessage} className="chat-reply-form">
                                    <div className="reply-input-group">
                                        <input
                                            type="text"
                                            placeholder="Type an official administrative message..."
                                            value={adminReply}
                                            onChange={(e) => setAdminReply(e.target.value)}
                                        />
                                        <ShieldCheck size={18} className="reply-icon" />
                                    </div>
                                    <button type="submit" disabled={!adminReply.trim() || sending} className="reply-send-btn">
                                        {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                                    </button>
                                </form>
                            </div>
                        </div>
                    ) : (
                        <div className="chat-empty-view">
                            <MessageSquare size={64} opacity={0.1} />
                            <p>Select a conversation from the sidebar to monitor or reply</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .admin-chat-monitor-root {
                    display: flex;
                    flex-direction: column;
                    height: 750px;
                    min-height: 600px;
                    background: white;
                    border-radius: 1.5rem;
                    overflow: hidden;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                    border: 1px solid #f1f5f9;
                    position: relative;
                    z-index: 1000;
                }
                .admin-monitor-header {
                    background: linear-gradient(135deg, #1e293b, #0f172a);
                    color: white;
                    padding: 1.25rem 2rem;
                    flex-shrink: 0;
                }
                .header-badge {
                    background: #6366f1;
                    padding: 0.2rem 0.6rem;
                    border-radius: 0.5rem;
                    font-size: 0.65rem;
                    font-weight: 900;
                    letter-spacing: 0.05em;
                }
                .admin-monitor-body {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                }
                .monitor-sidebar {
                    width: 300px;
                    border-right: 1px solid #f1f5f9;
                    display: flex;
                    flex-direction: column;
                    background: #f8fafc;
                    position: relative;
                    z-index: 100;
                }
                .sidebar-search { padding: 1rem; border-bottom: 1px solid #f1f5f9; }
                .search-box {
                    background: white;
                    padding: 0.6rem 1rem;
                    border-radius: 0.75rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    border: 1px solid #e2e8f0;
                }
                .search-box input { border: none; outline: none; font-size: 0.85rem; width: 100%; }
                .sidebar-list { flex: 1; overflow-y: auto; padding: 0.75rem; position: relative; z-index: 100; }
                .conv-item {
                    padding: 1rem;
                    border-radius: 1rem;
                    cursor: pointer;
                    margin-bottom: 0.5rem;
                    background: transparent;
                    transition: 0.2s;
                    position: relative;
                    z-index: 101;
                    pointer-events: auto;
                }
                .conv-item:hover { background: #f1f5f9; }
                .conv-item.active { background: white; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
                .conv-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
                .conv-title { font-weight: 800; font-size: 0.9rem; color: #1e293b; }
                .conv-count { background: #e2e8f0; padding: 0.1rem 0.4rem; border-radius: 0.4rem; font-size: 0.6rem; font-weight: 900; color: #475569; }
                .conv-item-sub { font-size: 0.75rem; color: #64748b; font-weight: 600; }
                .conv-item-tag { font-size: 0.65rem; color: #94a3b8; font-weight: 700; margin-top: 0.25rem; }

                
                .monitor-chat-main { flex: 1; display: flex; flex-direction: column; background: white; overflow: hidden; }
                .chat-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
                .chat-view-header { padding: 1rem 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 1rem; flex-shrink: 0; }
                .header-avatar { width: 40px; height: 40px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #6366f1; }
                
                .chat-messages-area { flex: 1; overflow-y: auto; padding: 1.5rem; background: #fcfcfc; min-height: 0; }
                .chat-msg-row { display: flex; flex-direction: column; margin-bottom: 1.5rem; }
                .chat-msg-row.left { align-items: flex-start; }
                .chat-msg-row.right { align-items: flex-end; }
                .chat-msg-meta { font-size: 0.7rem; color: #94a3b8; font-weight: 800; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.25rem; }
                .chat-msg-bubble { max-width: 75%; padding: 0.85rem 1.25rem; border-radius: 1.25rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .chat-msg-bubble.admin { background: #eff6ff; border: 1px solid #dbeafe; color: #1e293b; border-bottom-right-radius: 4px; }
                .chat-msg-bubble.parent { background: white; border: 1px solid #e2e8f0; border-bottom-left-radius: 4px; }
                .chat-msg-bubble.teacher { background: #f8fafc; border: 1px solid #f1f5f9; border-bottom-right-radius: 4px; }
                .chat-msg-bubble p { margin: 0; font-size: 0.93rem; line-height: 1.5; }
                .chat-msg-time { font-size: 0.6rem; opacity: 0.5; margin-top: 0.4rem; display: block; text-align: right; }

                .chat-reply-container { padding: 1.25rem; background: white; border-top: 1px solid #f1f5f9; flex-shrink: 0; }
                .chat-reply-form { display: flex; gap: 1rem; align-items: center; }
                .reply-input-group { flex: 1; position: relative; }
                .reply-input-group input { width: 100%; padding: 0.85rem 3rem 0.85rem 1.25rem; border-radius: 1.25rem; border: 1px solid #e2e8f0; outline: none; background: #f8fafc; font-size: 0.93rem; }
                .reply-input-group input:focus { border-color: #6366f1; background: white; }
                .reply-icon { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: #6366f1; opacity: 0.5; }
                .reply-send-btn { width: 48px; height: 48px; border-radius: 50%; background: #6366f1; color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(99,102,241,0.2); }
                .reply-send-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(99,102,241,0.3); }
                .reply-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                .chat-empty-view { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #cbd5e1; }
                
                .back-btn-mobile { display: none; background: transparent; border: none; cursor: pointer; color: #64748b; padding: 0; margin-right: 0.5rem; }

                @media (max-width: 768px) {
                    .admin-chat-monitor-root { 
                        height: calc(100vh - 120px); 
                        min-height: 500px;
                        border-radius: 0; 
                    }
                    .admin-monitor-body {
                        position: relative;
                    }
                    .monitor-sidebar { 
                        width: 100%; 
                        border-right: none;
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: white;
                        z-index: 10;
                    }
                    .monitor-sidebar.hide-mobile {
                        transform: translateX(-100%);
                        visibility: hidden;
                        z-index: 1;
                    }
                    .monitor-chat-main { 
                        width: 100%;
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 20;
                        background: white;
                    }
                    .monitor-chat-main.hide-mobile {
                        transform: translateX(100%);
                        visibility: hidden;
                        z-index: 1;
                    }
                    .back-btn-mobile { display: block; }
                    .chat-msg-bubble { max-width: 85%; }
                    .conv-item { padding: 0.75rem; }
                    .admin-monitor-header { padding: 1rem 1.25rem; }
                }
            `}</style>
        </div>
    );
};

export default AdminChatMonitor;
