import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, orderBy, onSnapshot, Timestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Send, User, Search, MessageSquare, Loader2, ChevronLeft, ShieldCheck, AlertTriangle, X } from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

interface Conversation {
    chatId: string;
    parentId: string;
    teacherId: string;
    parentName: string;
    teacherName: string;
    studentClass?: string;
    lastMessage: string;
    lastMessageTime: any;
    messageCount: number;
}

interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    senderName: string;
    receiverName: string;
    text: string;
    createdAt: any;
    isFromParent?: boolean;
    isAdmin?: boolean;
    chatId?: string;
}

const AdminChatMonitor: React.FC = () => {
    const { user } = useAuth();
    const { currentSchool } = useSchool();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [adminReply, setAdminReply] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showWipeModal, setShowWipeModal] = useState(false);
    const [wipeConfirmationText, setWipeConfirmationText] = useState('');
    const [isWiping, setIsWiping] = useState(false);
    const [showWipeButton, setShowWipeButton] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Real-time listener for conversations
    useEffect(() => {
        if (!currentSchool?.id) return;

        setLoading(true);

        const msgsRef = collection(db, 'messages');
        const q = query(
            msgsRef,
            where('schoolId', '==', currentSchool.id)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            try {
                const convMap = new Map<string, Conversation>();

                // Sort docs client-side to avoid index requirement
                const sortedDocs = [...snapshot.docs].sort((a, b) =>
                    (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0)
                );

                // First pass: Build conversation structure from parent-teacher messages
                sortedDocs.forEach(doc => {
                    const data = doc.data();

                    // Skip admin messages for building the conversation structure
                    if (data.isAdmin || data.receiverId === 'multiple') return;

                    // Build chatId robustly
                    const sId = data.senderId || 'unknown';
                    const rId = data.receiverId || 'unknown';
                    const ids = [sId, rId].sort();
                    const chatId = `${ids[0]}_${ids[1]}`;

                    if (!convMap.has(chatId)) {
                        convMap.set(chatId, {
                            chatId,
                            parentId: data.isFromParent ? data.senderId : data.receiverId,
                            teacherId: data.isFromParent ? data.receiverId : data.senderId,
                            parentName: data.isFromParent ? data.senderName : data.receiverName,
                            teacherName: data.isFromParent ? data.receiverName : data.senderName,
                            studentClass: data.parentClass || 'N/A',
                            lastMessage: data.text,
                            lastMessageTime: data.createdAt,
                            messageCount: 0
                        });
                    }
                });

                // Second pass: Update lastMessage and lastMessageTime with ALL messages (including admin)
                sortedDocs.forEach(doc => {
                    const data = doc.data();

                    // For admin messages, find the conversation by chatId
                    if (data.isAdmin || data.receiverId === 'multiple') {
                        const chatId = data.chatId;
                        if (chatId && convMap.has(chatId)) {
                            const conv = convMap.get(chatId)!;
                            // Update if this admin message is more recent
                            if (!conv.lastMessageTime || data.createdAt?.seconds > conv.lastMessageTime?.seconds) {
                                conv.lastMessage = data.text;
                                conv.lastMessageTime = data.createdAt;
                            }
                        }
                    } else {
                        // For parent-teacher messages
                        const sId = data.senderId || 'unknown';
                        const rId = data.receiverId || 'unknown';
                        const ids = [sId, rId].sort();
                        const chatId = `${ids[0]}_${ids[1]}`;

                        if (convMap.has(chatId)) {
                            const conv = convMap.get(chatId)!;
                            // Update if this message is more recent
                            if (!conv.lastMessageTime || data.createdAt?.seconds > conv.lastMessageTime?.seconds) {
                                conv.lastMessage = data.text;
                                conv.lastMessageTime = data.createdAt;
                            }
                        }
                    }
                });

                // Count total messages for each conversation efficiently
                const totalSnapshot = snapshot.docs;
                for (const [chatId, conv] of convMap.entries()) {
                    conv.messageCount = totalSnapshot.filter(doc => {
                        const data = doc.data();
                        const sId = data.senderId || 'unknown';
                        const rId = data.receiverId || 'unknown';
                        const ids = [sId, rId].sort();
                        return (`${ids[0]}_${ids[1]}` === chatId) || (data.isAdmin && data.chatId === chatId);
                    }).length;
                }

                // Sort by latest message time (WhatsApp style)
                const sorted = Array.from(convMap.values()).sort((a, b) =>
                    (b.lastMessageTime?.seconds || 0) - (a.lastMessageTime?.seconds || 0)
                );

                setConversations(sorted);
                setLoading(false);
            } catch (error) {
                console.error('Error processing conversations:', error);
                setLoading(false);
            }
        }, (error) => {
            console.error('Error fetching conversations:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentSchool?.id]);

    // Snapshot for real-time messages in active chat
    useEffect(() => {
        if (!selectedConversation || !currentSchool?.id) {
            setMessages([]);
            return;
        }

        const msgsRef = collection(db, 'messages');
        // Targeted query for this specific conversation to avoid scanning entire school messages
        // We filter for BOTH the school's messages AND this specific chatId
        // Note: Admin replies also contain the chatId now
        const q = query(
            msgsRef,
            where('schoolId', '==', currentSchool.id),
            where('chatId', '==', selectedConversation.chatId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allMsgs = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Ensure senderId and receiverId are strings for sorting later if needed
                    senderId: data.senderId || 'unknown',
                    receiverId: data.receiverId || 'unknown',
                    senderName: data.senderName || 'Unknown',
                    receiverName: data.receiverName || 'Unknown',
                    text: data.text || ''
                } as Message;
            });

            // Sort client-side
            const sorted = allMsgs.sort((a, b) => {
                const timeA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
                const timeB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
                return timeA - timeB;
            });

            setMessages(sorted);
        }, (error) => {
            console.error("Firestore Snapshot Error:", error);
            // If targeted query fails due to missing index, fallback to broader query
            if (error.message?.includes('index')) {
                const fallbackQ = query(msgsRef, where('schoolId', '==', currentSchool.id));
                onSnapshot(fallbackQ, (snap) => {
                    const fallbackMsgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message))
                        .filter(m => m.chatId === selectedConversation.chatId)
                        .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
                    setMessages(fallbackMsgs);
                });
            }
        });

        return () => unsubscribe();
    }, [selectedConversation?.chatId, currentSchool?.id]);

    const handleWipeAllMessages = async () => {
        if (wipeConfirmationText !== 'WIPE ALL CHAT MESSAGES' || isWiping) return;

        setIsWiping(true);
        try {
            const msgsRef = collection(db, 'messages');
            const q = query(msgsRef, where('schoolId', '==', currentSchool?.id));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                alert('No chat messages found for this school.');
                setShowWipeModal(false);
                setIsWiping(false);
                return;
            }

            const docs = snapshot.docs;
            const batchSize = 400;

            for (let i = 0; i < docs.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = docs.slice(i, i + batchSize);
                chunk.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }

            alert(`Successfully wiped ${docs.length} chat messages.`);
            setShowWipeModal(false);
            setWipeConfirmationText('');
            setSelectedConversation(null);
        } catch (error) {
            console.error('Error wiping messages:', error);
            alert('An error occurred while wiping messages. Please try again.');
        } finally {
            setIsWiping(false);
        }
    };

    const formatTime = (createdAt: any) => {
        if (!createdAt) return '';
        try {
            const date = createdAt.toDate ? createdAt.toDate() : (createdAt instanceof Date ? createdAt : new Date(createdAt.seconds * 1000));
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    };

    // Scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendAdminMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adminReply.trim() || !selectedConversation || !user || sending) return;

        setSending(true);
        try {
            await addDoc(collection(db, 'messages'), {
                chatId: selectedConversation.chatId,
                parentId: selectedConversation.parentId,
                teacherId: selectedConversation.teacherId,
                parentName: selectedConversation.parentName,
                teacherName: selectedConversation.teacherName,
                senderId: user.id || user.username || 'admin',
                receiverId: 'multiple',
                senderName: user.name || 'Administrator',
                receiverName: `${selectedConversation.parentName} & ${selectedConversation.teacherName}`,
                text: adminReply.trim(),
                createdAt: Timestamp.now(),
                isAdmin: true,
                isFromParent: false,
                schoolId: currentSchool?.id || '',
                parentClass: selectedConversation.studentClass
            });

            setAdminReply('');
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    const filteredConversations = conversations.filter(conv =>
        conv.parentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.studentClass?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
                <Loader2 className="animate-spin" size={48} color="var(--primary)" style={{ margin: '0 auto' }} />
                <p style={{ marginTop: '1.5rem', fontWeight: 600, color: '#64748b' }}>Initializing Admin Monitor...</p>
            </div>
        );
    }

    return (
        <div className="admin-chat-portal-v2">
            {/* Top Security Banner */}
            <div className="monitoring-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                    <ShieldCheck
                        size={20}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setShowWipeButton(!showWipeButton)}
                    />
                    <p><strong>Administrator Oversight Mode:</strong> You are monitoring active parent-teacher communications. Official replies will be visible to both parties.</p>
                </div>
                {showWipeButton && (
                    <button
                        onClick={() => setShowWipeModal(true)}
                        style={{
                            background: '#fee2e2',
                            color: '#ef4444',
                            border: '1px solid #fecaca',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            cursor: 'pointer'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#fecaca'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
                    >
                        <AlertTriangle size={14} /> Wipe All Chat Data
                    </button>
                )}
            </div>

            <div className="portal-layout">
                {/* Conversation List Sidebar */}
                <div className={`sidebar-container ${selectedConversation ? 'hide-mobile' : ''}`}>
                    <div className="search-area">
                        <div className="admin-search-box">
                            <Search size={18} color="#94a3b8" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="conv-list">
                        {filteredConversations.length > 0 ? filteredConversations.map(conv => (
                            <div
                                key={conv.chatId}
                                className={`conv-card ${selectedConversation?.chatId === conv.chatId ? 'active' : ''}`}
                                onClick={() => setSelectedConversation(conv)}
                            >
                                <div className="card-top">
                                    <span className="participants">{conv.parentName} ↔ {conv.teacherName}</span>
                                    <span className="msg-count">{conv.messageCount}</span>
                                </div>
                                <div className="card-meta">CLASS {conv.studentClass}</div>
                                <div className="card-last-text">{conv.lastMessage}</div>
                            </div>
                        )) : (
                            <div className="no-conv">No active conversations found</div>
                        )}
                    </div>
                </div>

                {/* Chat Details Area */}
                <div className={`chat-container-panel ${!selectedConversation ? 'hide-mobile' : ''}`}>
                    {selectedConversation ? (
                        <>
                            <div className="chat-header-bar">
                                <button className="back-btn" onClick={() => setSelectedConversation(null)}>
                                    <ChevronLeft size={24} />
                                </button>
                                <div className="chat-info">
                                    <h4>{selectedConversation.parentName} & {selectedConversation.teacherName}</h4>
                                    <span>Communication Log • Class {selectedConversation.studentClass}</span>
                                </div>
                            </div>

                            <div className="message-scroller" ref={scrollRef}>
                                {messages.map(msg => (
                                    <div key={msg.id} className={`msg-bubble-wrapper ${msg.isAdmin ? 'admin' : msg.isFromParent ? 'parent' : 'teacher'}`}>
                                        <div className="msg-sender-label">
                                            {msg.isAdmin ? <ShieldCheck size={12} /> : null}
                                            {msg.senderName}
                                        </div>
                                        <div className="msg-bubble">
                                            <p>{msg.text}</p>
                                            <span className="msg-time">
                                                {formatTime(msg.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <form className="admin-reply-form" onSubmit={handleSendAdminMessage}>
                                <div className="input-with-icon">
                                    <input
                                        type="text"
                                        placeholder="Type an official administrative reply..."
                                        value={adminReply}
                                        onChange={(e) => setAdminReply(e.target.value)}
                                    />
                                    <ShieldCheck size={20} className="floating-shield" />
                                </div>
                                <button type="submit" disabled={!adminReply.trim() || sending}>
                                    {sending ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="admin-empty-view">
                            <div className="empty-circle"><MessageSquare size={80} /></div>
                            <h3>Message Center</h3>
                            <p>Select a parent-teacher thread from the left to begin monitoring or for intervention.</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .admin-chat-portal-v2 {
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 160px);
                    min-height: 550px;
                    background: white;
                    border-radius: 1.5rem;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.08);
                    overflow: hidden;
                    border: 1px solid #e2e8f0;
                }

                .monitoring-header {
                    background: #fffbeb;
                    color: #92400e;
                    padding: 1rem 2rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    font-size: 0.85rem;
                    border-bottom: 2px solid #fef3c7;
                    flex-shrink: 0;
                }

                .portal-layout { display: flex; flex: 1; overflow: hidden; }

                .sidebar-container { 
                    width: 350px; 
                    border-right: 1px solid #f1f5f9; 
                    display: flex; 
                    flex-direction: column; 
                    background: #fbfcfd; 
                    flex-shrink: 0;
                }

                .search-area { padding: 1.5rem; border-bottom: 1px solid #f1f5f9; }
                .admin-search-box {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 1rem;
                    padding: 0.75rem 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .admin-search-box input {
                    border: none;
                    outline: none;
                    flex: 1;
                    font-size: 0.9rem;
                    font-weight: 500;
                    background: transparent;
                }

                .conv-list { flex: 1; overflow-y: auto; padding: 1rem; }
                .conv-card {
                    padding: 1.25rem;
                    border-radius: 1.25rem;
                    cursor: pointer;
                    transition: 0.2s;
                    margin-bottom: 0.75rem;
                    border: 1px solid transparent;
                }
                .conv-card:hover { background: #f1f5f9; }
                .conv-card.active { background: white; border-color: #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.03); }
                
                .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
                .participants { font-weight: 900; font-size: 0.95rem; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .msg-count { background: #6366f1; color: white; font-size: 0.65rem; font-weight: 900; padding: 0.15rem 0.6rem; border-radius: 2rem; }
                
                .card-meta { font-size: 0.7rem; font-weight: 800; color: #64748b; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.02em; }
                .card-last-text { font-size: 0.8rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }

                .chat-container-panel { flex: 1; display: flex; flex-direction: column; background: white; position: relative; }
                .chat-header-bar { padding: 1.25rem 2rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 1.25rem; flex-shrink: 0; }
                .back-btn { display: none; background: #f1f5f9; border: none; padding: 0.5rem; border-radius: 0.75rem; cursor: pointer; color: #64748b; }
                .chat-info h4 { margin: 0; font-size: 1.15rem; font-weight: 900; color: #1e293b; }
                .chat-info span { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; }

                .message-scroller { flex: 1; overflow-y: auto; padding: 2rem; background: #fcfdfe; display: flex; flex-direction: column; gap: 1.5rem; }
                .msg-bubble-wrapper { display: flex; flex-direction: column; width: 100%; }
                .msg-bubble-wrapper.admin { align-items: flex-end; }
                .msg-bubble-wrapper.parent { align-items: flex-start; }
                .msg-bubble-wrapper.teacher { align-items: flex-end; }

                .msg-sender-label { font-size: 0.7rem; font-weight: 900; color: #94a3b8; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem; text-transform: uppercase; }
                .admin .msg-sender-label { color: #6366f1; }
                
                .msg-bubble { max-width: 75%; padding: 1rem 1.5rem; border-radius: 1.5rem; box-shadow: 0 4px 10px rgba(0,0,0,0.02); line-height: 1.6; font-size: 0.95rem; font-weight: 500; position: relative; }
                .admin .msg-bubble { background: #eff6ff; color: #1e293b; border: 1px solid #dbeafe; border-bottom-right-radius: 4px; }
                .parent .msg-bubble { background: white; color: #1e293b; border: 1px solid #e2e8f0; border-bottom-left-radius: 4px; }
                .teacher .msg-bubble { background: #f8fafc; color: #1e293b; border: 1px solid #f1f5f9; border-bottom-right-radius: 4px; }
                
                .msg-time { display: block; font-size: 0.65rem; opacity: 0.5; margin-top: 0.5rem; text-align: right; font-weight: 700; }

                .admin-reply-form { padding: 1.5rem 2rem; background: white; border-top: 1px solid #f1f5f9; display: flex; gap: 1.25rem; flex-shrink: 0; }
                .input-with-icon { flex: 1; position: relative; }
                .input-with-icon input { width: 100%; height: 56px; padding: 0 4rem 0 1.5rem; border-radius: 1.5rem; border: 2px solid #f1f5f9; background: #f8fafc; outline: none; font-size: 1rem; font-weight: 500; transition: 0.2s; }
                .input-with-icon input:focus { border-color: #6366f1; background: white; }
                .floating-shield { position: absolute; right: 1.25rem; top: 50%; transform: translateY(-50%); color: #6366f1; opacity: 0.3; }
                
                .admin-reply-form button { width: 56px; height: 56px; border-radius: 50%; background: #6366f1; border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; box-shadow: 0 10px 20px rgba(99,102,241,0.25); }
                .admin-reply-form button:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(99,102,241,0.3); }
                .admin-reply-form button:disabled { opacity: 0.5; cursor: not-allowed; }

                .admin-empty-view { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #cbd5e1; text-align: center; padding: 3rem; }
                .empty-circle { width: 140px; height: 140px; background: #f8fafc; border-radius: 3rem; display: flex; align-items: center; justify-content: center; color: #e2e8f0; margin-bottom: 2rem; }
                .admin-empty-view h3 { color: #1e293b; font-size: 1.5rem; font-weight: 900; margin-bottom: 0.5rem; }
                .admin-empty-view p { max-width: 400px; line-height: 1.6; font-weight: 500; color: #94a3b8; }

                @media (max-width: 768px) {
                    .admin-chat-portal-v2 { height: calc(100vh - 100px); border-radius: 0; }
                    .sidebar-container { width: 100%; border-right: none; }
                    .chat-container-panel { width: 100%; border-left: none; }
                    .hide-mobile { display: none !important; }
                    .back-btn { display: block; }
                    .admin-reply-form { padding: 1rem; }
                    .msg-bubble { max-width: 85%; }
                    .conv-card { padding: 1rem; }
                    .monitoring-header { padding: 0.75rem 1rem; font-size: 0.75rem; }
                }
            `}</style>
            {/* Wipe Confirmation Modal */}
            {showWipeModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '1rem'
                }}>
                    <div className="glass-card" style={{
                        width: '100%',
                        maxWidth: '500px',
                        padding: '2rem',
                        position: 'relative',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        animation: 'slideUp 0.3s ease-out',
                        background: 'white',
                        borderRadius: '1rem'
                    }}>
                        <button
                            onClick={() => {
                                if (!isWiping) {
                                    setShowWipeModal(false);
                                    setWipeConfirmationText('');
                                }
                            }}
                            style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                        >
                            <X size={24} />
                        </button>

                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                background: '#fee2e2',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem',
                                color: '#ef4444'
                            }}>
                                <AlertTriangle size={36} />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', marginBottom: '0.5rem' }}>Delete All Chat History?</h2>
                            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                This action <strong style={{ color: '#ef4444' }}>CANNOT BE UNDONE</strong>. It will permanently delete every message across all conversations in this school.
                            </p>
                        </div>

                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.75rem', textAlign: 'center' }}>
                                To confirm, please type <strong style={{ color: '#111827', userSelect: 'all' }}>WIPE ALL CHAT MESSAGES</strong> in the box below:
                            </p>
                            <input
                                type="text"
                                className="admin-chat-input"
                                autoFocus
                                value={wipeConfirmationText}
                                onChange={(e) => setWipeConfirmationText(e.target.value)}
                                placeholder="Type the text exactly..."
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    border: '2px solid',
                                    textAlign: 'center',
                                    fontWeight: 700,
                                    borderColor: wipeConfirmationText === 'WIPE ALL CHAT MESSAGES' ? '#22c55e' : '#e2e8f0',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                style={{
                                    flex: 1,
                                    padding: '0.75rem',
                                    borderRadius: '0.75rem',
                                    border: '1px solid #e2e8f0',
                                    background: 'white',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    color: '#64748b'
                                }}
                                onClick={() => {
                                    setShowWipeModal(false);
                                    setWipeConfirmationText('');
                                }}
                                disabled={isWiping}
                            >
                                Cancel
                            </button>
                            <button
                                style={{
                                    flex: 2,
                                    padding: '0.75rem',
                                    borderRadius: '0.75rem',
                                    background: wipeConfirmationText === 'WIPE ALL CHAT MESSAGES' ? '#ef4444' : '#fca5a5',
                                    color: 'white',
                                    border: 'none',
                                    fontWeight: 800,
                                    opacity: wipeConfirmationText === 'WIPE ALL CHAT MESSAGES' ? 1 : 0.7,
                                    cursor: wipeConfirmationText === 'WIPE ALL CHAT MESSAGES' ? 'pointer' : 'not-allowed',
                                    boxShadow: wipeConfirmationText === 'WIPE ALL CHAT MESSAGES' ? '0 4px 12px rgba(239, 68, 68, 0.2)' : 'none'
                                }}
                                onClick={handleWipeAllMessages}
                                disabled={wipeConfirmationText !== 'WIPE ALL CHAT MESSAGES' || isWiping}
                            >
                                {isWiping ? 'Wiping Everything...' : 'Confirm Wipe All Data'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminChatMonitor;
