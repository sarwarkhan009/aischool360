import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, orderBy, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Send, User, Search, MessageSquare, Loader2, ChevronLeft, AlertTriangle, BookOpen, Users, X, ShieldCheck } from 'lucide-react';
import { useSchool } from '../../context/SchoolContext';

interface Props {
    studentClass?: string;
    section?: string;
}

interface Teacher {
    id: string;
    name: string;
    subjects?: string[];
    lastMessage?: string;
    lastMessageTime?: any;
    unreadCount?: number;
}

interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    senderName: string;
    text: string;
    createdAt: any;
    isAdmin?: boolean;
}

const ParentChat: React.FC<Props> = ({ studentClass, section }) => {
    const { user } = useAuth();
    const { currentSchool } = useSchool();
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [activeTeacher, setActiveTeacher] = useState<Teacher | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeTeacherRef = useRef<string | null>(null);

    // Keep ref in sync for real-time listeners
    useEffect(() => {
        activeTeacherRef.current = activeTeacher?.id || null;
    }, [activeTeacher]);


    // New Chat Modal States
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [searchTeacherQuery, setSearchTeacherQuery] = useState('');
    const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
    const [loadingAllTeachers, setLoadingAllTeachers] = useState(false);

    // 1. Fetch Teachers - REAL-TIME with existing conversations
    useEffect(() => {
        const targetSchoolId = currentSchool?.id || user?.schoolId;
        if (!targetSchoolId || !user?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const timeout = setTimeout(() => setLoading(false), 5000);

        const msgsRef = collection(db, 'messages');

        // Real-time listeners for messages involving this parent
        const qByMe = query(
            msgsRef,
            where('schoolId', '==', targetSchoolId),
            where('senderId', '==', user.id)
        );

        const qToMe = query(
            msgsRef,
            where('schoolId', '==', targetSchoolId),
            where('receiverId', '==', user.id)
        );

        // Function to process messages and update teacher list
        const processMessages = async (allMsgs: any[]) => {
            const conversationMeta = new Map<string, { lastMsg: string, lastTime: any, teacherData: any, unreadCount: number }>();

            for (const mDoc of allMsgs) {
                const data = mDoc.data();

                // Identify the teacher ID for this chat
                let otherId = '';
                if (data.isAdmin) {
                    otherId = data.teacherId;
                } else {
                    otherId = data.senderId === user.id ? data.receiverId : data.senderId;
                }

                if (!otherId || otherId === 'multiple' || otherId === 'admin') continue;

                // Initialize conversation metadata if not exists
                if (!conversationMeta.has(otherId)) {
                    conversationMeta.set(otherId, {
                        lastMsg: '',
                        lastTime: null,
                        teacherData: null,
                        unreadCount: 0
                    });
                }

                const meta = conversationMeta.get(otherId)!;

                // Update last message info
                if (!meta.lastTime || data.createdAt?.seconds > meta.lastTime?.seconds) {
                    meta.lastMsg = data.text;
                    meta.lastTime = data.createdAt;
                }

                // Count unread messages (messages FROM teacher TO parent that are newer than last read)
                if (data.senderId !== user.id && data.receiverId === user.id) {
                    // Logic: If chat is open, mark as read. Otherwise count if new.
                    if (activeTeacherRef.current === otherId) {
                        const lastReadKey = `lastRead_${user.id}_${otherId}`;
                        localStorage.setItem(lastReadKey, Math.floor(Date.now() / 1000).toString());
                    } else {
                        const lastReadKey = `lastRead_${user.id}_${otherId}`;
                        const lastReadTimestamp = localStorage.getItem(lastReadKey);
                        const lastReadSeconds = lastReadTimestamp ? parseInt(lastReadTimestamp) : 0;

                        if (data.createdAt?.seconds > lastReadSeconds) {
                            meta.unreadCount++;
                        }
                    }
                }
            }

            // Fetch teacher details for each conversation
            const finalTeachers: Teacher[] = [];
            for (const [teacherId, meta] of conversationMeta.entries()) {
                try {
                    const tDoc = await getDoc(doc(db, 'teachers', teacherId));
                    if (tDoc.exists()) {
                        const tData = tDoc.data();
                        finalTeachers.push({
                            id: teacherId,
                            name: tData.name || 'Teacher',
                            subjects: tData.subjects || ['Teacher'],
                            lastMessage: meta.lastMsg,
                            lastMessageTime: meta.lastTime,
                            unreadCount: meta.unreadCount
                        });
                    }
                } catch (err) {
                    console.error('Error fetching teacher:', err);
                }
            }

            // Sort: Most recent conversation first
            finalTeachers.sort((a, b) => {
                return (b.lastMessageTime?.seconds || 0) - (a.lastMessageTime?.seconds || 0);
            });

            setTeachers(finalTeachers);
            clearTimeout(timeout);
            setLoading(false);
        };

        // Subscribe to both queries
        const unsubscribe1 = onSnapshot(qByMe, async (snap1) => {
            const unsubscribe2 = onSnapshot(qToMe, async (snap2) => {
                const allMsgs = [...snap1.docs, ...snap2.docs];
                await processMessages(allMsgs);
            });

            return () => unsubscribe2();
        });

        return () => unsubscribe1();
    }, [currentSchool?.id, user?.id, user?.schoolId, studentClass]);

    // Fetch all teachers for "New Chat" modal
    useEffect(() => {
        const targetSchoolId = currentSchool?.id || user?.schoolId;
        if (!isNewChatModalOpen || !targetSchoolId) {
            setAllTeachers([]);
            return;
        }

        const fetchAllTeachers = async () => {
            setLoadingAllTeachers(true);
            try {
                const targetSchoolId = currentSchool?.id || user?.schoolId;
                if (!targetSchoolId) {
                    setLoadingAllTeachers(false);
                    return;
                }

                const teachersRef = collection(db, 'teachers');
                const q = query(
                    teachersRef,
                    where('schoolId', '==', targetSchoolId)
                );
                const snap = await getDocs(q);

                let results = snap.docs
                    .filter(d => {
                        const data = d.data();
                        if (data.status === 'INACTIVE') return false;

                        // 1. Role Filter: Only show teaching staff
                        const role = (data.employeeType || data.designation || '').toLowerCase();
                        if (!role.includes('teacher')) return false;

                        const teachingClasses = (data.teachingClasses || []).map((c: any) => String(c).trim().toLowerCase());
                        const classTeacher = String(data.classTeacher || '').trim().toLowerCase();
                        const lookingFor = String(studentClass || '').toLowerCase().trim();

                        // If class is unknown, don't show anyone (strict mode)
                        if (!lookingFor || lookingFor === 'undefined' || lookingFor === 'n/a' || lookingFor === 'null') return false;

                        const lookingForShort = lookingFor.replace(/class/gi, '').trim();

                        const isMatch = teachingClasses.some((tc: string) => {
                            const tcShort = tc.replace(/class/gi, '').trim();
                            return tc === lookingFor || tc.includes(lookingForShort) || (lookingForShort && tcShort === lookingForShort);
                        }) || (classTeacher === lookingFor || classTeacher.includes(lookingForShort));

                        return isMatch;
                    })
                    .map(d => ({
                        id: d.id,
                        name: d.data().name || 'Teacher',
                        subjects: d.data().subjects || ['Teacher']
                    } as Teacher));

                if (searchTeacherQuery.trim()) {
                    const qLower = searchTeacherQuery.toLowerCase();
                    results = results.filter(t =>
                        t.name.toLowerCase().includes(qLower) ||
                        (t.subjects || []).some(s => s.toLowerCase().includes(qLower))
                    );
                }

                results.sort((a, b) => a.name.localeCompare(b.name));
                setAllTeachers(results);
            } catch (err) {
                console.error('Error fetching all teachers:', err);
            } finally {
                setLoadingAllTeachers(false);
            }
        };

        const timer = setTimeout(fetchAllTeachers, 500);
        return () => clearTimeout(timer);
    }, [isNewChatModalOpen, searchTeacherQuery, currentSchool?.id, user?.schoolId, studentClass]);

    const handleTeacherSelect = (teacher: Teacher) => {
        // Check if teacher already in list
        if (!teachers.find(t => t.id === teacher.id)) {
            setTeachers(prev => [teacher, ...prev]);
        }

        if (!user) return;
        // Mark messages as read by saving current timestamp
        const lastReadKey = `lastRead_${user.id}_${teacher.id}`;
        localStorage.setItem(lastReadKey, Math.floor(Date.now() / 1000).toString());

        // Clear unread count for this teacher
        setTeachers(prev => prev.map(t =>
            t.id === teacher.id ? { ...t, unreadCount: 0 } : t
        ));

        setActiveTeacher(teacher);
        setIsNewChatModalOpen(false);
    };

    // 2. Subscribe to messages when a teacher is selected
    useEffect(() => {
        const targetSchoolId = currentSchool?.id || user?.schoolId;
        if (!user?.id || !activeTeacher || !targetSchoolId) {
            setMessages([]);
            return;
        }

        const chatId = [user.id, activeTeacher.id].sort().join('_');
        const msgsRef = collection(db, 'messages');
        const q = query(
            msgsRef,
            where('chatId', '==', chatId),
            where('schoolId', '==', targetSchoolId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
            newMsgs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            setMessages(newMsgs);
            setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        return () => unsubscribe();
    }, [activeTeacher, user?.id, currentSchool?.id, user?.schoolId]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user?.id || !activeTeacher || sending) return;

        setSending(true);
        try {
            const chatId = [user.id, activeTeacher.id].sort().join('_');
            await addDoc(collection(db, 'messages'), {
                chatId,
                senderId: user.id,
                receiverId: activeTeacher.id,
                senderName: user.name || user.username || 'Parent',
                receiverName: activeTeacher.name,
                text: newMessage.trim(),
                createdAt: Timestamp.now(),
                parentClass: studentClass,
                parentSection: section,
                isFromParent: true,
                schoolId: currentSchool?.id || user?.schoolId
            });
            setNewMessage('');

            // Update local teacher list last message info
            setTeachers(prev => prev.map(t =>
                t.id === activeTeacher.id
                    ? { ...t, lastMessage: newMessage.trim(), lastMessageTime: Timestamp.now() }
                    : t
            ));
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
                <Loader2 className="animate-spin" size={40} color="var(--primary)" style={{ margin: '0 auto' }} />
                <p style={{ marginTop: '1rem', fontWeight: 600, color: '#64748b' }}>Loading your conversations...</p>
            </div>
        );
    }

    return (
        <div className="parent-chat-portal glass-card">
            {/* Compact Professional Banner */}
            <div className="privacy-banner">
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <p><strong>Professional Use Only:</strong> Monitored by administration. Keep communications strictly academic.</p>
            </div>

            <div className="portal-content">
                {/* Sidebar (Conversation List) */}
                <div className={`sidebar-panel ${activeTeacher || isNewChatModalOpen ? 'hide-mobile' : ''}`}>
                    <div className="sidebar-header">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div className="header-icon"><BookOpen size={20} /></div>
                                <div>
                                    <h3>Teachers</h3>
                                    <p>{teachers.length} conversation{teachers.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsNewChatModalOpen(true)}
                                style={{
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.5rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    fontSize: '0.75rem',
                                    fontWeight: 700
                                }}
                            >
                                <MessageSquare size={14} /> New
                            </button>
                        </div>
                    </div>

                    <div className="sidebar-scroll">
                        {teachers.length > 0 ? teachers.map(t => (
                            <div
                                key={t.id}
                                className={`sidebar-item ${activeTeacher?.id === t.id ? 'active' : ''}`}
                                onClick={() => {
                                    if (!user) return;
                                    // Mark messages as read by saving current timestamp
                                    const lastReadKey = `lastRead_${user.id}_${t.id}`;
                                    localStorage.setItem(lastReadKey, Math.floor(Date.now() / 1000).toString());

                                    // Clear unread count for this teacher
                                    setTeachers(prev => prev.map(teacher =>
                                        teacher.id === t.id ? { ...teacher, unreadCount: 0 } : teacher
                                    ));
                                    setActiveTeacher(t);
                                    setIsNewChatModalOpen(false);
                                }}
                            >
                                <div className="avatar-circle"><User size={20} /></div>
                                <div className="item-details">
                                    <div className="item-top">
                                        <span className="name">{t.name}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {t.unreadCount! > 0 && (
                                                <span className="unread-badge">{t.unreadCount}</span>
                                            )}
                                            {t.lastMessageTime && (
                                                <span className="time">
                                                    {t.lastMessageTime?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="item-subject">{t.subjects?.join(', ') || 'Class Teacher'}</div>
                                    {t.lastMessage && (
                                        <div className="last-msg-preview">{t.lastMessage}</div>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="empty-sidebar">No conversation found.</div>
                        )}
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className={`chat-panel ${!activeTeacher && !isNewChatModalOpen ? 'hide-mobile' : ''}`}>
                    {isNewChatModalOpen ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                            <div className="chat-interface-header">
                                <button className="mobile-back" onClick={() => setIsNewChatModalOpen(false)}>
                                    <ChevronLeft size={24} />
                                </button>
                                <div className="teacher-meta">
                                    <div style={{ width: '32px', height: '32px', background: '#eff6ff', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Search size={16} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontWeight: 900, fontSize: '1rem', margin: 0 }}>New Conversation</h4>
                                        <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>SELECT A TEACHER</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                                <div style={{ position: 'relative' }}>
                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    <input
                                        type="text"
                                        placeholder="Search by teacher name or subject..."
                                        value={searchTeacherQuery}
                                        onChange={(e) => setSearchTeacherQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 1rem 0.75rem 3rem',
                                            borderRadius: '1rem',
                                            border: '1px solid #e2e8f0',
                                            fontSize: '0.9rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                                {loadingAllTeachers ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto' }} />
                                    </div>
                                ) : allTeachers.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                        {allTeachers.map(t => (
                                            <div
                                                key={t.id}
                                                onClick={() => handleTeacherSelect(t)}
                                                style={{
                                                    background: 'white',
                                                    padding: '1rem',
                                                    borderRadius: '1rem',
                                                    border: '1px solid #f1f5f9',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '1rem'
                                                }}
                                                className="hover-lift"
                                            >
                                                <div style={{ width: '40px', height: '40px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                                                    <User size={20} />
                                                </div>
                                                <div>
                                                    <p style={{ fontWeight: 800, margin: 0, fontSize: '0.9rem' }}>{t.name}</p>
                                                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontWeight: 600 }}>
                                                        {t.subjects?.join(', ') || 'Teacher'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
                                        <Users size={48} style={{ margin: '0 auto 1rem' }} />
                                        <p style={{ fontWeight: 700 }}>No teachers found</p>
                                        <p style={{ fontSize: '0.8rem' }}>Try a different search term</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeTeacher ? (
                        <>
                            <div className="chat-interface-header">
                                <button className="mobile-back" onClick={() => setActiveTeacher(null)}>
                                    <ChevronLeft size={24} />
                                </button>
                                <div className="teacher-meta">
                                    <User size={18} />
                                    <div>
                                        <h4>{activeTeacher.name}</h4>
                                        <p>{activeTeacher.subjects?.join(', ') || 'Teacher'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="chat-scroll-view">
                                {messages.length > 0 ? messages.map((msg) => (
                                    <div key={msg.id} className={`bubble-row ${msg.senderId === user?.id ? 'sent' : 'received'}`}>
                                        <div className="bubble">
                                            {msg.isAdmin && <div className="admin-tag"><ShieldCheck size={10} /> Admin Response</div>}
                                            <p>{msg.text}</p>
                                            <span className="timestamp">
                                                {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="chat-empty-state">
                                        <MessageSquare size={48} opacity={0.1} />
                                        <p>Start a conversation about academic progress, homework, or attendance.</p>
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>

                            <form className="chat-reply-bar" onSubmit={handleSendMessage}>
                                <input
                                    type="text"
                                    placeholder="Type your message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                />
                                <button type="submit" disabled={!newMessage.trim() || sending}>
                                    {sending ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="chat-placeholder-view">
                            <div className="icon-wrap"><MessageSquare size={64} /></div>
                            <h3>Academic Support Chat</h3>
                            <p>Select a teacher from the list to discuss your child's education.</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .parent-chat-portal {
                    display: flex;
                    flex-direction: column;
                    height: 650px;
                    border: 1px solid #f1f5f9;
                    overflow: hidden;
                    background: white;
                }
                .privacy-banner {
                    background: #fffbeb;
                    padding: 0.4rem 1rem;
                    border-bottom: 1px solid #fef3c7;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: #92400e;
                    font-size: 0.75rem;
                }
                .privacy-banner p { margin: 0; font-weight: 600; }
                .portal-content { display: flex; flex: 1; overflow: hidden; }
                
                .sidebar-panel { width: 320px; border-right: 1px solid #f1f5f9; display: flex; flex-direction: column; background: #fbfcfd; }
                .sidebar-header { padding: 1.5rem; border-bottom: 1px solid #f1f5f9; }
                .sidebar-header h3 { margin: 0; font-size: 1.1rem; font-weight: 900; }
                .sidebar-header p { margin: 0; font-size: 0.75rem; color: #64748b; font-weight: 700; }
                .header-icon { width: 40px; height: 40px; background: var(--primary); color: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                
                .sidebar-scroll { flex: 1; overflow-y: auto; padding: 0.5rem; }
                .sidebar-item { display: flex; gap: 1rem; padding: 1rem; border-radius: 1rem; cursor: pointer; transition: 0.2s; margin-bottom: 0.25rem; }
                .sidebar-item:hover { background: #f1f5f9; }
                .sidebar-item.active { background: #eff6ff; border: 1px solid #dbeafe; }
                .avatar-circle { width: 44px; height: 44px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b; flex-shrink: 0; }
                .sidebar-item.active .avatar-circle { background: var(--primary); color: white; }
                
                .item-details { flex: 1; overflow: hidden; }
                .item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.1rem; }
                .name { font-weight: 800; font-size: 0.9rem; color: #1e293b; }
                .time { font-size: 0.65rem; color: #94a3b8; font-weight: 700; }
                .item-subject { font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 0.4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .last-msg-preview { font-size: 0.75rem; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

                .unread-badge { 
                    background: #ef4444; 
                    color: white; 
                    font-size: 0.65rem; 
                    font-weight: 900; 
                    padding: 0.15rem 0.5rem; 
                    border-radius: 12px; 
                    min-width: 18px; 
                    text-align: center; 
                    display: inline-block;
                }

                .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); }

                .chat-panel { flex: 1; display: flex; flex-direction: column; background: white; }
                .chat-interface-header { padding: 1rem 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 1rem; }
                .mobile-back { display: none; background: transparent; border: none; cursor: pointer; }
                .teacher-meta { display: flex; align-items: center; gap: 1rem; }
                .teacher-meta h4 { margin: 0; font-size: 1rem; font-weight: 900; }
                .teacher-meta p { margin: 0; font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; }

                .chat-scroll-view { flex: 1; overflow-y: auto; padding: 1.5rem; background: #f8fafc; display: flex; flex-direction: column; gap: 1rem; }
                .bubble-row { display: flex; width: 100%; }
                .bubble-row.sent { justify-content: flex-end; }
                .bubble { max-width: 70%; padding: 0.85rem 1.25rem; border-radius: 1.25rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02); line-height: 1.5; font-size: 0.93rem; }
                .sent .bubble { background: var(--primary); color: white; border-bottom-right-radius: 4px; }
                .received .bubble { background: white; border: 1px solid #e2e8f0; color: #1e293b; border-bottom-left-radius: 4px; }
                .timestamp { font-size: 0.65rem; opacity: 0.6; display: block; margin-top: 0.4rem; text-align: right; }
                .admin-tag { font-size: 0.6rem; font-weight: 900; color: #6366f1; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.25rem; text-transform: uppercase; }

                .chat-reply-bar { padding: 1.25rem; background: white; border-top: 1px solid #f1f5f9; display: flex; gap: 1rem; }
                .chat-reply-bar input { flex: 1; border: 1px solid #e2e8f0; padding: 0.85rem 1.25rem; border-radius: 1.25rem; outline: none; font-size: 0.93rem; background: #f8fafc; }
                .chat-reply-bar input:focus { border-color: var(--primary); background: white; }
                .chat-reply-bar button { width: 48px; height: 48px; background: var(--primary); color: white; border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
                .chat-reply-bar button:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(99,102,241,0.2); }

                .chat-placeholder-view { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; text-align: center; padding: 2rem; }
                .icon-wrap { width: 100px; height: 100px; background: #f8fafc; border-radius: 2rem; display: flex; align-items: center; justify-content: center; color: #cbd5e1; margin-bottom: 2rem; }
                
                @media (max-width: 768px) {
                    .hide-mobile { display: none; }
                    .sidebar-panel { width: 100% !important; border-right: none; height: 100%; }
                    .chat-panel { width: 100% !important; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
                    .mobile-back { display: block !important; padding: 0.5rem; color: #1e293b; margin-right: 0.25rem; }
                    
                    /* FORCE edge-to-edge - escape parent container */
                    .parent-chat-portal { 
                        position: relative;
                        width: 100vw !important;
                        height: 85vh !important; 
                        left: 50%;
                        right: 50%;
                        margin-left: -50vw !important;
                        margin-right: -50vw !important;
                        margin-top: -2rem !important;
                        margin-bottom: 0 !important;
                        padding: 0 !important;
                        border-radius: 0 !important; 
                        border: none !important;
                        background: white !important;
                        box-shadow: none !important;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }

                    .portal-content { 
                        flex: 1; 
                        width: 100%;
                        border-radius: 0; 
                        display: flex;
                        flex-direction: column;
                        overflow: hidden; 
                        background: white;
                    }
                    
                    /* Ultra-thin banner */
                    .privacy-banner {
                        padding: 0.35rem 0.75rem;
                        font-size: 0.6rem;
                        gap: 0.4rem;
                        border: none;
                        background: #fffbeb;
                    }
                    .privacy-banner svg { width: 12px; height: 12px; }
                    .privacy-banner strong { display: none; }
                    
                    /* Compact Sidebar */
                    .sidebar-header { padding: 0.85rem 1rem; border-bottom: 2px solid #f8fafc; }
                    .sidebar-header h3 { font-size: 0.9rem; }
                    .sidebar-header p { font-size: 0.65rem; }
                    .header-icon { width: 28px; height: 28px; border-radius: 8px; }
                    .header-icon svg { width: 16px; height: 16px; }
                    
                    .sidebar-scroll { padding: 0.25rem; }
                    .sidebar-item { padding: 0.75rem 1rem; margin-bottom: 0; border-bottom: 1px solid #f8fafc; border-radius: 0; }
                    .sidebar-item.active { background: #eff6ff; border: none; border-left: 3px solid var(--primary); }
                    .avatar-circle { width: 34px; height: 34px; }
                    .item-details { gap: 0.1rem; }
                    .name { font-size: 0.85rem; }
                    .item-subject { font-size: 0.62rem; margin-bottom: 0.1rem; }
                    .last-msg-preview { font-size: 0.72rem; }

                    /* Chat Interface Header */
                    .chat-interface-header { 
                        padding: 0.5rem 0.75rem; 
                        background: white;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .teacher-meta { gap: 0.6rem !important; }
                    .teacher-meta h4 { font-size: 0.85rem !important; }

                    /* Messages view */
                    .chat-scroll-view { padding: 1rem 0.75rem; background: #fafbfc; }
                    .bubble { max-width: 90%; padding: 0.6rem 0.85rem; font-size: 0.88rem; }
                    
                    /* Reply Bar - Stick to bottom properly */
                    .chat-reply-bar { 
                        padding: 0.6rem 0.75rem; 
                        background: white;
                        gap: 0.5rem;
                    }
                    .chat-reply-bar input { 
                        padding: 0.65rem 1rem; 
                        font-size: 0.88rem;
                        height: 38px;
                    }
                    .chat-reply-bar button { 
                        width: 38px; 
                        height: 38px; 
                    }
                }
            `}</style>
        </div>
    );
};

export default ParentChat;
