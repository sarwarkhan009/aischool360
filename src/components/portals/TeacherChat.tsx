import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, orderBy, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useSchool } from '../../context/SchoolContext';
import { Send, User, MessageSquare, Loader2, ChevronLeft, AlertTriangle, Users, Search, X, Filter, ShieldCheck } from 'lucide-react';
import { getActiveClasses } from '../../constants/app';

interface Parent {
    id: string;
    name: string;
    studentName?: string;
    studentClass?: string;
    studentSection?: string;
    lastMessage?: string;
    lastMessageTime?: any;
    unreadCount?: number;
}

interface Student {
    id: string;
    name: string;
    fullName?: string;
    class: string;
    section: string;
    fatherContactNo?: string;
    motherContactNo?: string;
    mobileNo?: string;
}

interface Message {
    id: string;
    senderId: string;
    receiverId: string;
    text: string;
    createdAt: any;
    senderName?: string;
    parentClass?: string;
    isAdmin?: boolean;
}

const TeacherChat: React.FC = () => {
    const { user } = useAuth();
    const { currentSchool } = useSchool();
    const [parents, setParents] = useState<Parent[]>([]);
    const [activeParent, setActiveParent] = useState<Parent | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const activeParentRef = useRef<string | null>(null);

    // Keep ref in sync for real-time listeners
    useEffect(() => {
        activeParentRef.current = activeParent?.id || null;
    }, [activeParent]);


    // New Chat States
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [searchStudentQuery, setSearchStudentQuery] = useState('');
    const [selectedClass, setSelectedClass] = useState('ALL'); // Default to 'ALL' to search across all classes
    const [studentResults, setStudentResults] = useState<Student[]>([]);
    const [classes, setClasses] = useState<string[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [teacherProfile, setTeacherProfile] = useState<any>(null);

    // Fetch Teacher Profile & Classes
    useEffect(() => {
        if (!user?.id || !currentSchool?.id) return;
        const fetchTeacherData = async () => {
            try {
                if (!user.id) return;
                const teacherRef = doc(db, 'teachers', user.id);
                const teacherSnap = await getDoc(teacherRef);

                let assignedClasses: string[] = [];

                if (teacherSnap.exists()) {
                    const data = teacherSnap.data();
                    setTeacherProfile(data);

                    const tc = data.teachingClasses || [];
                    const ct = data.classTeacher;
                    const allAssigned = [...tc];
                    if (ct) allAssigned.push(ct);

                    assignedClasses = allAssigned.map(c => String(c).split('-')[0]);
                    assignedClasses = Array.from(new Set(assignedClasses)).sort();
                }

                if (assignedClasses.length === 0) {
                    const q = query(
                        collection(db, 'settings'),
                        where('type', '==', 'class'),
                        where('schoolId', '==', currentSchool.id)
                    );
                    const snap = await getDocs(q);
                    assignedClasses = snap.docs
                        .filter(d => !d.data().disabled)
                        .map(d => d.data().name);
                }

                setClasses(Array.from(new Set(assignedClasses)).sort());
            } catch (err) {
                console.error('Error fetching teacher data:', err);
            }
        };
        fetchTeacherData();
    }, [user?.id, currentSchool?.id]);

    // Search Students
    useEffect(() => {
        if (!isNewChatModalOpen || !currentSchool?.id || classes.length === 0) {
            setStudentResults([]);
            return;
        }

        const fetchStudents = async () => {
            setLoadingStudents(true);
            try {
                let allResults: Student[] = [];

                // If searching, search across ALL teacher's classes
                if (searchStudentQuery.trim()) {
                    const qLower = searchStudentQuery.toLowerCase();

                    // Search in all teacher's assigned classes
                    for (const className of classes) {
                        const q = query(
                            collection(db, 'students'),
                            where('schoolId', '==', currentSchool.id),
                            where('class', '==', className),
                            where('status', '==', 'ACTIVE')
                        );

                        const snap = await getDocs(q);
                        const classResults = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
                        allResults = [...allResults, ...classResults];
                    }

                    // Filter by search query
                    allResults = allResults.filter(s =>
                        (s.name || '').toLowerCase().includes(qLower) ||
                        (s.fullName || '').toLowerCase().includes(qLower) ||
                        (s.id || '').toLowerCase().includes(qLower)
                    );
                }
                // If NOT searching but a specific class is selected, show that class's students
                else if (selectedClass && selectedClass !== 'ALL') {
                    const q = query(
                        collection(db, 'students'),
                        where('schoolId', '==', currentSchool.id),
                        where('class', '==', selectedClass),
                        where('status', '==', 'ACTIVE')
                    );

                    const snap = await getDocs(q);
                    allResults = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
                }
                // Otherwise (no search, no specific class), show empty list

                // Sort by class then name
                allResults.sort((a, b) => {
                    const classCompare = (a.class || '').localeCompare(b.class || '');
                    if (classCompare !== 0) return classCompare;
                    return (a.name || a.fullName || '').localeCompare(b.name || b.fullName || '');
                });

                setStudentResults(allResults.slice(0, 50));
            } catch (err) {
                console.error('Error fetching students:', err);
            } finally {
                setLoadingStudents(false);
            }
        };

        const timer = setTimeout(fetchStudents, 500);
        return () => clearTimeout(timer);
    }, [searchStudentQuery, selectedClass, isNewChatModalOpen, currentSchool?.id, classes]);

    const handleStudentSelect = (student: Student) => {
        const studentName = student.name || student.fullName || 'Student';
        const parentName = `Parent of ${studentName}`;

        const newParent: Parent = {
            id: student.id, // We use student doc ID as parent ID for simplicity in this system
            name: parentName,
            studentName: studentName,
            studentClass: student.class,
            studentSection: student.section
        };

        // Check if parent already in list
        if (!parents.find(p => p.id === newParent.id)) {
            setParents(prev => [newParent, ...prev]);
        }

        // Mark as read
        const lastReadKey = `lastRead_teacher_${user?.id}_${newParent.id}`;
        localStorage.setItem(lastReadKey, Math.floor(Date.now() / 1000).toString());

        // Clear local count
        setParents(prev => prev.map(p =>
            p.id === newParent.id ? { ...p, unreadCount: 0 } : p
        ));

        setActiveParent(newParent);
        setIsNewChatModalOpen(false);
    };

    // Fetch all parents who have messaged this teacher or whom teacher has messaged - REAL-TIME
    useEffect(() => {
        const targetSchoolId = currentSchool?.id || user?.schoolId;
        if (!user?.id || !targetSchoolId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const timeout = setTimeout(() => setLoading(false), 5000);

        const msgsRef = collection(db, 'messages');

        // Query 1: Messages sent by this teacher
        const qSent = query(
            msgsRef,
            where('schoolId', '==', targetSchoolId),
            where('senderId', '==', user.id)
        );

        // Query 2: Messages received by this teacher
        const qReceived = query(
            msgsRef,
            where('schoolId', '==', targetSchoolId),
            where('receiverId', '==', user.id)
        );

        // Query 3: Admin messages sent to this chat
        const qAdmin = query(
            msgsRef,
            where('schoolId', '==', targetSchoolId),
            where('teacherId', '==', user.id),
            where('isAdmin', '==', true)
        );

        const processMessages = async (allDocs: any[]) => {
            const conversationMeta = new Map<string, { lastMsg: string, lastTime: any, parentData: any, unreadCount: number }>();

            allDocs.forEach(doc => {
                const data = doc.data();

                // Identify the parent ID for this chat
                let otherId = '';
                if (data.isAdmin) {
                    otherId = data.parentId;
                } else {
                    otherId = data.senderId === user.id ? data.receiverId : data.senderId;
                }

                if (!otherId || otherId === 'multiple' || otherId === 'admin') return;

                // Initialize metadata if not exists
                if (!conversationMeta.has(otherId)) {
                    conversationMeta.set(otherId, {
                        lastMsg: '',
                        lastTime: null,
                        unreadCount: 0,
                        parentData: {
                            id: otherId,
                            name: data.isAdmin ? (data.parentName || 'Parent') : (data.isFromParent ? (data.senderName || 'Parent') : (data.receiverName || 'Parent')),
                            studentClass: data.parentClass,
                            studentName: data.isAdmin ? (data.parentName || 'Parent') : (data.isFromParent ? data.senderName : data.receiverName)
                        }
                    });
                }

                const meta = conversationMeta.get(otherId)!;

                // Update last message info
                if (!meta.lastTime || data.createdAt?.seconds > meta.lastTime?.seconds) {
                    meta.lastMsg = data.text;
                    meta.lastTime = data.createdAt;
                }

                // Count unread messages (messages FROM parent/admin TO teacher that are newer than last read)
                if (data.senderId !== user.id && data.receiverId === user.id) {
                    // If chat is open, mark as read instantly
                    if (activeParentRef.current === otherId) {
                        const lastReadKey = `lastRead_teacher_${user.id}_${otherId}`;
                        localStorage.setItem(lastReadKey, Math.floor(Date.now() / 1000).toString());
                    } else {
                        const lastReadKey = `lastRead_teacher_${user.id}_${otherId}`;
                        const lastReadTimestamp = localStorage.getItem(lastReadKey);
                        const lastReadSeconds = lastReadTimestamp ? parseInt(lastReadTimestamp) : 0;

                        if (data.createdAt?.seconds > lastReadSeconds) {
                            meta.unreadCount++;
                        }
                    }
                }
            });

            // Convert to Parent array and sort
            const finalParents: Parent[] = Array.from(conversationMeta.values()).map(meta => ({
                ...meta.parentData,
                lastMessage: meta.lastMsg,
                lastMessageTime: meta.lastTime,
                unreadCount: meta.unreadCount
            }));

            // Sort: Most recent conversation first
            finalParents.sort((a, b) => {
                return (b.lastMessageTime?.seconds || 0) - (a.lastMessageTime?.seconds || 0);
            });

            setParents(finalParents);
            clearTimeout(timeout);
            setLoading(false);
        };

        // Subscribe to all 3 queries
        const unsub1 = onSnapshot(qSent, (s1) => {
            const unsub2 = onSnapshot(qReceived, (s2) => {
                const unsub3 = onSnapshot(qAdmin, (s3) => {
                    const allDocs = [...s1.docs, ...s2.docs, ...s3.docs];
                    processMessages(allDocs);
                });
                return () => unsub3();
            });
            return () => unsub2();
        });

        return () => unsub1();
    }, [user?.id, currentSchool?.id, user?.schoolId]);

    // Subscribe to messages with selected parent
    useEffect(() => {
        if (!user?.id || !activeParent) {
            setMessages([]);
            return;
        }

        const chatId = [user.id, activeParent.id].sort().join('_');
        const msgsRef = collection(db, 'messages');
        const targetSchoolId = currentSchool?.id || user?.schoolId;
        const q = query(
            msgsRef,
            where('chatId', '==', chatId),
            where('schoolId', '==', targetSchoolId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMsgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Message));
            newMsgs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
            setMessages(newMsgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });

        return () => unsubscribe();
    }, [activeParent, user?.id, currentSchool?.id, user?.schoolId]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user?.id || !activeParent || sending) return;

        setSending(true);
        try {
            const chatId = [user.id, activeParent.id].sort().join('_');
            await addDoc(collection(db, 'messages'), {
                chatId,
                senderId: user.id,
                receiverId: activeParent.id,
                senderName: user.name || user.username,
                receiverName: activeParent.name,
                text: newMessage.trim(),
                createdAt: Timestamp.now(),
                isFromParent: false,
                schoolId: currentSchool?.id || user?.schoolId,
                parentClass: activeParent.studentClass
            });
            setNewMessage('');
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
                <p style={{ marginTop: '1rem', fontWeight: 600, color: '#64748b' }}>Loading messages...</p>
            </div>
        );
    }

    return (
        <div className="chat-portal-container glass-card">
            {/* Compact Privacy Notice Banner */}
            <div style={{
                background: '#fffbeb',
                padding: '0.4rem 1rem',
                borderBottom: '1px solid #fef3c7',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: '#92400e',
                fontSize: '0.75rem'
            }}>
                <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>
                    <strong>Professional Use Only:</strong> Monitored by administration. Keep communications strictly academic.
                </p>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Sidebar / Parent List */}
                <div className={`teacher-list-panel ${activeParent || isNewChatModalOpen ? 'hide-mobile' : ''}`}>
                    <div className="panel-header">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '12px', display: 'flex' }}>
                                    <Users size={18} />
                                </div>
                                <h3 style={{ fontWeight: 900, fontSize: '1.25rem', margin: 0 }}>Parent Messages</h3>
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
                        <p style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, margin: 0 }}>
                            {parents.length} conversation{parents.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="teacher-scroll-area">
                        {parents.length > 0 ? parents.map(p => (
                            <div
                                key={p.id}
                                className={`teacher-item ${activeParent?.id === p.id ? 'active' : ''}`}
                                onClick={() => {
                                    // Mark as read
                                    const lastReadKey = `lastRead_teacher_${user?.id}_${p.id}`;
                                    localStorage.setItem(lastReadKey, Math.floor(Date.now() / 1000).toString());

                                    // Clear local count
                                    setParents(prev => prev.map(parent =>
                                        parent.id === p.id ? { ...parent, unreadCount: 0 } : parent
                                    ));

                                    setActiveParent(p);
                                    setIsNewChatModalOpen(false);
                                }}
                            >
                                <div className="teacher-avatar">
                                    <User size={20} />
                                </div>
                                <div className="teacher-info" style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <p className="teacher-name">{p.name}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            {p.unreadCount! > 0 && (
                                                <span className="unread-badge">{p.unreadCount}</span>
                                            )}
                                            {p.lastMessageTime && (
                                                <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700 }}>
                                                    {p.lastMessageTime?.toDate ? p.lastMessageTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="teacher-subjects">
                                        {p.studentClass ? `Student: Class ${p.studentClass}` : 'Parent'}
                                    </p>
                                    {p.lastMessage && (
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.2rem 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p.lastMessage}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                                <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                <p style={{ fontWeight: 700, color: '#64748b' }}>No Messages Yet</p>
                                <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Parent messages will appear here</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                <div className={`chat-main-panel ${!activeParent && !isNewChatModalOpen ? 'hide-mobile' : ''}`}>
                    {isNewChatModalOpen ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                            <div className="chat-header">
                                <button className="back-btn" onClick={() => setIsNewChatModalOpen(false)}>
                                    <ChevronLeft size={24} />
                                </button>
                                <div className="active-teacher-info">
                                    <div className="avatar-small"><Search size={16} /></div>
                                    <div>
                                        <h4 style={{ fontWeight: 900, fontSize: '1rem', margin: 0 }}>New Conversation</h4>
                                        <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>SEARCH STUDENT PARENT</p>
                                    </div>
                                </div>
                            </div>

                            <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto',
                                    gap: '1rem',
                                    marginBottom: '1rem'
                                }} className="new-chat-filters">
                                    <div style={{ position: 'relative' }}>
                                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                                        <input
                                            type="text"
                                            placeholder="Search by student name or roll..."
                                            value={searchStudentQuery}
                                            onChange={(e) => setSearchStudentQuery(e.target.value)}
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
                                    <div style={{ minWidth: '150px' }}>
                                        <select
                                            value={selectedClass}
                                            onChange={(e) => setSelectedClass(e.target.value)}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                borderRadius: '1rem',
                                                border: '1px solid #e2e8f0',
                                                fontSize: '0.9rem',
                                                outline: 'none',
                                                background: 'white'
                                            }}
                                        >
                                            <option value="ALL">All Classes</option>
                                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                                {loadingStudents ? (
                                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                                        <Loader2 className="animate-spin" style={{ margin: '0 auto' }} />
                                    </div>
                                ) : studentResults.length > 0 ? (
                                    <div className="student-results-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                        {studentResults.map(s => (
                                            <div
                                                key={s.id}
                                                onClick={() => handleStudentSelect(s)}
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
                                                    <p style={{ fontWeight: 800, margin: 0, fontSize: '0.9rem' }}>{s.name || s.fullName}</p>
                                                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0, fontWeight: 600 }}>
                                                        Class {s.class} {s.section ? `• ${s.section}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '4rem', opacity: 0.5 }}>
                                        <Users size={48} style={{ margin: '0 auto 1rem' }} />
                                        <p style={{ fontWeight: 700 }}>Select a class or search for a student</p>
                                        <p style={{ fontSize: '0.8rem' }}>Choose a specific class to view all students, or use the search to find students across all your classes</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeParent ? (
                        <>
                            <div className="chat-header">
                                <button className="back-btn" onClick={() => setActiveParent(null)}>
                                    <ChevronLeft size={24} />
                                </button>
                                <div className="active-teacher-info">
                                    <div className="avatar-small"><User size={16} /></div>
                                    <div>
                                        <h4 style={{ fontWeight: 900, fontSize: '1rem', margin: 0 }}>{activeParent.name}</h4>
                                        <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                                            {activeParent.studentClass ? `Class ${activeParent.studentClass}` : 'Parent'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="messages-area">
                                {messages.length > 0 ? messages.map((msg) => (
                                    <div key={msg.id} className={`message-bubble-wrapper ${msg.senderId === user?.id ? 'sent' : 'received'}`}>
                                        <div className="message-bubble">
                                            {msg.isAdmin && (
                                                <div className="admin-tag">
                                                    <ShieldCheck size={12} /> ADMIN RESPONSE
                                                </div>
                                            )}
                                            <p>{msg.text}</p>
                                            <span className="msg-time">
                                                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="chat-empty">
                                        <MessageSquare size={48} opacity={0.1} />
                                        <p>No messages yet with {activeParent.name}</p>
                                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>Start a professional conversation</p>
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>

                            <form className="chat-input-area" onSubmit={handleSendMessage}>
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
                        <div className="chat-placeholder">
                            <div className="placeholder-icon">
                                <MessageSquare size={64} />
                            </div>
                            <h3>Select a parent to view messages</h3>
                            <p>Parent conversations will appear here</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .chat-portal-container {
                    display: flex;
                    flex-direction: column;
                    min-height: 650px;
                    padding: 0;
                    overflow: hidden;
                    border: 1px solid #f1f5f9;
                }
                .teacher-list-panel {
                    width: 320px;
                    border-right: 1px solid #f1f5f9;
                    display: flex;
                    flex-direction: column;
                }
                .panel-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid #f1f5f9;
                    background: #f8fafc;
                }
                .teacher-scroll-area {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem;
                }
                .teacher-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    border-radius: 1rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 0.5rem;
                }
                .teacher-item:hover { background: #f1f5f9; }
                .teacher-item.active { background: #eff6ff; border: 1px solid #dbeafe; }
                .teacher-avatar {
                    width: 44px;
                    height: 44px;
                    background: #e2e8f0;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                    flex-shrink: 0;
                }
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
                .teacher-item.active .teacher-avatar { background: var(--primary); color: white; }
                .teacher-name { font-weight: 800; color: #1e293b; font-size: 0.9375rem; margin: 0; }
                .teacher-subjects { font-size: 0.75rem; color: #64748b; font-weight: 600; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

                .chat-main-panel {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #ffffff;
                }
                .chat-header {
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    background: white;
                }
                .back-btn { display: none; background: transparent; border: none; cursor: pointer; color: #64748b; }
                .active-teacher-info { display: flex; align-items: center; gap: 0.75rem; }
                .avatar-small { width: 32px; height: 32px; background: #eff6ff; color: var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; }

                .messages-area {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .message-bubble-wrapper { display: flex; width: 100%; }
                .message-bubble-wrapper.sent { justify-content: flex-end; }
                .message-bubble {
                    max-width: 70%;
                    padding: 0.85rem 1.25rem;
                    border-radius: 1.25rem;
                    position: relative;
                    font-size: 0.9375rem;
                    line-height: 1.5;
                }
                .sent .message-bubble { 
                    background: var(--primary); 
                    color: white; 
                    border-bottom-right-radius: 4px;
                }
                .received .message-bubble { 
                    background: white; 
                    color: #1e293b; 
                    border: 1px solid #e2e8f0;
                    border-bottom-left-radius: 4px;
                }
                .msg-time { font-size: 0.65rem; opacity: 0.7; margin-top: 0.4rem; display: block; text-align: right; }
                .admin-tag {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    font-size: 0.65rem;
                    font-weight: 900;
                    color: #6366f1;
                    margin-bottom: 0.5rem;
                    text-transform: uppercase;
                    letter-spacing: 0.02em;
                }

                .chat-input-area {
                    padding: 1.25rem;
                    display: flex;
                    gap: 1rem;
                    background: white;
                    border-top: 1px solid #f1f5f9;
                }
                .chat-input-area input {
                    flex: 1;
                    border: 1px solid #e2e8f0;
                    padding: 0.85rem 1.25rem;
                    border-radius: 1.25rem;
                    outline: none;
                    transition: all 0.2s;
                    font-size: 0.9375rem;
                }
                .chat-input-area input:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(99,102,241,0.1); }
                .chat-input-area button {
                    width: 48px;
                    height: 48px;
                    background: var(--primary);
                    color: white;
                    border: none;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .chat-input-area button:hover:not(:disabled) { transform: scale(1.05); background: #4f46e5; }
                .chat-input-area button:disabled { opacity: 0.5; cursor: not-allowed; }

                .chat-placeholder {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #94a3b8;
                    text-align: center;
                    padding: 2rem;
                }
                .placeholder-icon { width: 120px; height: 120px; background: #f8fafc; border-radius: 3rem; display: flex; align-items: center; justify-content: center; color: #cbd5e1; margin-bottom: 1.5rem; }
                .chat-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; }
                
                @media (max-width: 768px) {
                    .chat-portal-container { height: calc(100vh - 250px); }
                    .teacher-list-panel { width: 100%; border-right: none; }
                    .chat-main-panel { width: 100%; }
                    .hide-mobile { display: none; }
                    .back-btn { display: block; }
                    .message-bubble { max-width: 85%; }
                    
                    /* New Chat Modal Mobile Optimizations */
                    .new-chat-filters {
                        grid-template-columns: 1fr !important;
                    }
                    
                    .student-results-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </div >
    );
};

export default TeacherChat;
