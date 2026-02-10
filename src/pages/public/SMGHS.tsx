import React, { useEffect } from 'react';
import { Shield, MapPin, Phone, Clock, GraduationCap, Award, CheckCircle2, ArrowRight, Play, Sparkles } from 'lucide-react';
import './SMGHS.css';

const SMGHS: React.FC = () => {
    useEffect(() => {
        // Simple observer for scroll animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-active');
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    return (
        <div className="smghs-container">
            <div className="mesh-bg-decorative"></div>

            {/* Navigation */}
            <nav className="smghs-nav">
                <div className="smghs-logo">
                    St. Margaret's <span>High School</span>
                </div>
                <div className="smghs-nav-links">
                    <a href="#features">Excellence</a>
                    <a href="#about">Legacy</a>
                    <a href="#admission">Admissions</a>
                    <a href="#contact">Contact</a>
                    <a href="#apply" className="smghs-btn-apply">Online Admission</a>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="smghs-hero">
                <div className="blob blob-maroon" style={{ width: '400px', height: '400px', top: '-10%', left: '-5%' }}></div>
                <div className="smghs-hero-content">
                    <div className="smghs-hero-badge">
                        <Sparkles size={14} />
                        Affiliated to JAC | Estd. 1952
                    </div>
                    <h1>
                        Empowering <span>Girls</span> <br />
                        through Wisdom
                    </h1>
                    <p>
                        St. Margaret's Girls' High School, Ranchi — a sanctuary of discipline and
                        academic brilliance. Nurturing the leaders of tomorrow with a legacy that transcends generations.
                    </p>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" style={{ padding: '1.25rem 2.5rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1rem' }}>
                            Start Your Journey <ArrowRight size={18} />
                        </button>
                        <button className="btn" style={{ padding: '1.25rem 2.5rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1rem', border: '1px solid rgba(0,0,0,0.1)' }}>
                            <div style={{ background: 'var(--smghs-maroon)', color: 'white', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Play size={14} fill="currentColor" />
                            </div>
                            Virtual Tour
                        </button>
                    </div>
                </div>
                <div className="smghs-hero-image">
                    <div className="hero-img-container">
                        <img
                            src="/smghs/building.png"
                            alt="St. Margaret's Girls' High School Building"
                        />
                        <div style={{ position: 'absolute', bottom: '2rem', left: '-2rem', background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: 'var(--shadow-premium)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ background: 'var(--smghs-accent)', padding: '0.75rem', borderRadius: '12px' }}>
                                <CheckCircle2 color="var(--smghs-maroon)" size={24} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--smghs-maroon)' }}>70+ Years</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--smghs-muted)' }}>Educational Legacy</div>
                            </div>
                        </div>
                    </div>
                    <div className="blob blob-gold" style={{ width: '300px', height: '300px', bottom: '10%', right: '10%' }}></div>
                </div>
            </section>

            {/* Pride Section */}
            <section id="features" className="smghs-features">
                <div className="section-title" style={{ textAlign: 'center' }}>
                    <div className="smghs-hero-badge" style={{ margin: '0 auto 1.5rem' }}>Our Distinction</div>
                    <h2 style={{ fontSize: '3.5rem', fontFamily: 'Playfair Display', color: 'var(--smghs-maroon)' }}>The Pillars of SMGHS</h2>
                    <p style={{ color: 'var(--smghs-muted)', maxWidth: '600px', margin: '0 auto', fontSize: '1.15rem' }}>
                        Education is not just about grades; it's about forming character and building resilience.
                    </p>
                </div>

                <div className="feature-grid">
                    <div className="feature-card">
                        <div className="feature-icon">
                            <Shield size={36} />
                        </div>
                        <h3>Unmatched Discipline</h3>
                        <p>We foster a culture of respect and punctuality, ensuring students develop life-long ethical values.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">
                            <GraduationCap size={36} />
                        </div>
                        <h3>Exclusive for Girls</h3>
                        <p>Providing a dedicated and secure environment designed to build confidence in young women.</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">
                            <Award size={36} />
                        </div>
                        <h3>Ethical Education</h3>
                        <p>Our commitment to social impact means high-quality education with <strong>Zero Monthly Fees</strong>.</p>
                    </div>
                </div>
            </section>

            {/* Academic Section */}
            <section className="smghs-info-box">
                <div className="info-content">
                    <div style={{ color: 'var(--smghs-gold)', fontWeight: 700, marginBottom: '1.5rem', letterSpacing: '0.2em' }}>CURRICULUM EXCELLENCE</div>
                    <h2>Class VI to X <br />JAC Affiliated</h2>
                    <p style={{ fontSize: '1.2rem', opacity: 0.9, lineHeight: 1.8 }}>
                        Following the Jharkhand Academic Council framework, we offer a rigorous academic program
                        supplemented with modern learning techniques and traditional values.
                    </p>
                    <div className="info-stats">
                        <div className="stat-item">
                            <h4>06-10</h4>
                            <p>Grades</p>
                        </div>
                        <div className="stat-item">
                            <h4>100%</h4>
                            <p>Result</p>
                        </div>
                        <div className="stat-item">
                            <h4>FREE</h4>
                            <p>Monthly Fees</p>
                        </div>
                    </div>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                    <div className="glass-card" style={{ padding: '0.5rem', borderRadius: '32px', transform: 'rotate(-2deg)' }}>
                        <img
                            src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=800"
                            alt="Students Learning"
                            style={{ width: '100%', borderRadius: '28px' }}
                        />
                    </div>
                    {/* Floating badge */}
                    <div style={{ position: 'absolute', top: '2rem', right: '-1rem', background: 'var(--smghs-gold)', color: 'white', padding: '1rem 2rem', borderRadius: '50px', fontWeight: 800, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', transform: 'rotate(5deg)' }}>
                        Top Rated in Ranchi
                    </div>
                </div>
            </section>

            {/* Values Grid */}
            <section style={{ padding: '10rem 8%', background: '#fdfcf7' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <img src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=400" alt="Lab" style={{ width: '100%', borderRadius: '24px', boxShadow: 'var(--shadow-premium)' }} />
                            <img src="https://images.unsplash.com/photo-1577891729319-f4871c65486d?auto=format&fit=crop&q=80&w=400" alt="Sports" style={{ width: '100%', borderRadius: '24px', marginTop: '3rem', boxShadow: 'var(--shadow-premium)' }} />
                        </div>
                        <div className="blob blob-maroon" style={{ width: '200px', height: '200px', opacity: 0.1, top: '20%', left: '20%' }}></div>
                    </div>
                    <div>
                        <div className="smghs-hero-badge">Our Legacy</div>
                        <h2 style={{ fontSize: '3.5rem', color: 'var(--smghs-maroon)', marginBottom: '2rem', fontFamily: 'Playfair Display' }}>A Tradition of Excellence Since 1952</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {[
                                "JAC Affiliated Center of Excellence",
                                "Scientific Laboratories & Modern Library",
                                "Expert Dedicated Female Faculty",
                                "Life Skills & Personality Development"
                            ].map((text, i) => (
                                <div key={i} style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', background: 'white', padding: '1.25rem', borderRadius: '16px', boxShadow: '0 5px 15px rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.03)', transition: 'transform 0.3s ease', cursor: 'default' }}>
                                    <div style={{ background: 'var(--smghs-accent)', padding: '0.5rem', borderRadius: '50%' }}>
                                        <CheckCircle2 color="var(--smghs-maroon)" size={20} />
                                    </div>
                                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" style={{ padding: '10rem 8%', position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8rem' }}>
                    <div>
                        <div className="smghs-hero-badge">Get in Touch</div>
                        <h2 style={{ fontSize: '3.5rem', color: 'var(--smghs-maroon)', marginBottom: '3rem', fontFamily: 'Playfair Display' }}>Visit Our Campus</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                                <div style={{ background: 'var(--smghs-maroon)', color: 'white', padding: '1rem', borderRadius: '18px', boxShadow: '0 10px 20px rgba(128,0,0,0.2)' }}>
                                    <MapPin size={28} />
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', color: 'var(--smghs-maroon)', fontWeight: 700 }}>Our Location</h4>
                                    <p style={{ color: 'var(--smghs-muted)', fontSize: '1.1rem', lineHeight: 1.6 }}>Church Road, Konka, Kanka, Ranchi,<br />Jharkhand, 834001</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                                <div style={{ background: 'var(--smghs-gold)', color: 'white', padding: '1rem', borderRadius: '18px', boxShadow: '0 10px 20px rgba(197,160,40,0.2)' }}>
                                    <Phone size={28} />
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', color: 'var(--smghs-maroon)', fontWeight: 700 }}>Phone Inquiries</h4>
                                    <p style={{ color: 'var(--smghs-muted)', fontSize: '1.1rem' }}>0651-2350406</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                                <div style={{ background: 'var(--smghs-maroon)', color: 'white', padding: '1rem', borderRadius: '18px', boxShadow: '0 10px 20px rgba(128,0,0,0.2)' }}>
                                    <Clock size={28} />
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '1.4rem', marginBottom: '0.75rem', color: 'var(--smghs-maroon)', fontWeight: 700 }}>Operation Hours</h4>
                                    <p style={{ color: 'var(--smghs-muted)', fontSize: '1.1rem' }}>Mon - Sat: 08:30 AM - 02:30 PM</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card" style={{ padding: '4rem', borderRadius: '40px', border: '1px solid rgba(128,0,0,0.05)' }}>
                        <h3 style={{ marginBottom: '2.5rem', fontSize: '2rem', fontFamily: 'Playfair Display', color: 'var(--smghs-maroon)' }}>Admission Inquiry</h3>
                        <form style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <input type="text" placeholder="Student Name" className="input-field" style={{ borderRadius: '14px' }} />
                                <input type="text" placeholder="Applying Class" className="input-field" style={{ borderRadius: '14px' }} />
                            </div>
                            <input type="email" placeholder="Parent's Email Address" className="input-field" style={{ borderRadius: '14px' }} />
                            <input type="text" placeholder="Contact Number" className="input-field" style={{ borderRadius: '14px' }} />
                            <textarea placeholder="Tell us about yourself..." className="input-field" style={{ minHeight: '150px', borderRadius: '18px', resize: 'none' }}></textarea>
                            <button className="smghs-btn-apply" style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', fontWeight: 700, cursor: 'pointer' }}>Submit Inquiry</button>
                        </form>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="smghs-footer">
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '6rem', marginBottom: '6rem' }}>
                    <div>
                        <div className="smghs-logo" style={{ marginBottom: '2rem' }}>
                            St. Margaret's <span>High School</span>
                        </div>
                        <p style={{ color: 'var(--smghs-muted)', maxWidth: '350px', fontSize: '1.1rem', lineHeight: 1.7 }}>
                            Nurturing young minds with discipline, wisdom and modern education since 1952. Ranchi's premier institution for girls' excellence.
                        </p>
                    </div>
                    <div className="footer-column">
                        <h4>Explore</h4>
                        <ul style={{ listStyle: 'none' }}>
                            <li>History & Legacy</li>
                            <li>Academic Calendar</li>
                            <li>Campus Life</li>
                            <li>Mandatory Disclosures</li>
                        </ul>
                    </div>
                    <div className="footer-column">
                        <h4>Programs</h4>
                        <ul style={{ listStyle: 'none' }}>
                            <li>Middle School (VI - VIII)</li>
                            <li>Secondary (IX - X)</li>
                            <li>JAC Curriculum</li>
                            <li>Library & Labs</li>
                        </ul>
                    </div>
                    <div className="footer-column">
                        <h4>Connect</h4>
                        <ul style={{ listStyle: 'none' }}>
                            <li>Facebook</li>
                            <li>Instagram</li>
                            <li>Alumni Association</li>
                            <li>Contact Us</li>
                        </ul>
                    </div>
                </div>
                <div style={{ textAlign: 'center', paddingTop: '3rem', borderTop: '1px solid #f0f0f0', color: 'var(--smghs-muted)', fontSize: '0.95rem' }}>
                    &copy; {new Date().getFullYear()} St. Margaret's Girls' High School, Ranchi. <br />
                    Powered by AI School 360
                </div>
            </footer>
        </div>
    );
};

export default SMGHS;
