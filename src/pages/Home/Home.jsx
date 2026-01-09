import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import I from '../../components/Icon';
import Header from '../../components/Header';

const HomePage = () => {
  const navigate = useNavigate();

  const handleServiceClick = (service) => {
    // Scroll to top of the page
    window.scrollTo(0, 0);
    
    if (service === 'Quick Cost Projection') {
      navigate('/costprojection');
    } else if (service === 'Life Care Plan') {
      navigate('/lifecareplan');
    } else if (service === 'Medical Cost Projection') {
      navigate('/medicalcostprojection');
    }
  };

  const services = [
    { 
      name: 'Quick Cost Projection', 
      time: '< 60 Minutes', 
      emoji: '⚡', 
      payment: 'Pay-as-you-go available'
    },
    { 
      name: 'Medical Record Review', 
      time: '3-5 days', 
      emoji: '📄', 
      payment: 'Private pricing'
    },
    { 
      name: 'Medical Cost Projection', 
      time: '3-5 days', 
      emoji: '💰', 
      payment: 'Private pricing'
    },
    { 
      name: 'LCP Review', 
      time: '2-3 days', 
      emoji: '✅', 
      payment: 'Private pricing'
    },
    { 
      name: 'Life Care Plan', 
      time: '5-7 days', 
      emoji: '📋', 
      payment: 'Private pricing'
    }
  ];

  const deliverables = [
    { 
      icon: 'arrowRight', 
      title: 'Future Medical Needs', 
      desc: 'Projected medical requirements and timeline'
    },
    { 
      icon: 'fileText', 
      title: 'Health Context Analysis', 
      desc: 'Comprehensive medical history integration'
    },
    { 
      icon: 'dollarSign', 
      title: 'Cost Projections', 
      desc: 'Detailed financial impact analysis'
    },
    { 
      icon: 'clipboardCheck', 
      title: 'Treatment Pathways', 
      desc: 'Evidence-based care recommendations'
    }
  ];

  const audiences = [
    { 
      icon: 'user', 
      title: 'Physician Expert Witnesses', 
      desc: 'AI-powered analysis for expert testimony'
    },
    { 
      icon: 'building', 
      title: 'Law Firms & Insurers', 
      desc: 'Streamlined case preparation workflows'
    },
    { 
      icon: 'clipboardCheck', 
      title: 'Workers\' Comp Administrators', 
      desc: 'State-compliant medical reviews'
    },
    { 
      icon: 'users', 
      title: 'Third-Party Administrators', 
      desc: 'Scalable medical-legal operations'
    },
    { 
      icon: 'workflow', 
      title: 'Medical-Legal Service Providers', 
      desc: 'Enhanced service capabilities'
    }
  ];

  const features = [
    {
      title: 'HIPAA Compliant',
      description: 'Enterprise-grade security with end-to-end encryption',
      icon: 'shield'
    },
    {
      title: 'AI-Powered Analysis',
      description: 'Advanced algorithms for accurate medical cost projections',
      icon: 'brain'
    },
    {
      title: 'Expert Validated',
      description: 'All outputs reviewed by medical professionals',
      icon: 'checkCircle'
    },
    {
      title: 'Fast Turnaround',
      description: 'Get results in hours, not weeks',
      icon: 'zap'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Medical-Legal Analysis,
              <span className="text-blue-600"> Powered by AI</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
              Secure, HIPAA-compliant platform for expert witnesses, law firms, and insurers to streamline medical record reviews and cost projections.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/register')}
                className="px-8 py-4 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Start Free Trial
              </button>
              <button
                onClick={() => navigate('/demo')}
                className="px-8 py-4 border-2 border-blue-600 text-blue-600 rounded-lg text-lg font-semibold hover:bg-blue-50 transition-colors"
              >
                Schedule Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-4">
                  <I name={feature.icon} size={28} className="text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audiences */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Trusted by Medical-Legal Professionals
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-3xl mx-auto">
            Our secure, HIPAA-aligned AI infrastructure modernizes how experts and organizations handle complex cases across multiple domains
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {audiences.map((item, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow text-center">
                <I name={item.icon} size={40} className="text-blue-600 mb-4 mx-auto" />
                <h3 className="font-semibold text-sm mb-2">{item.title}</h3>
                <p className="text-xs text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Deliverables */}
      <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            Comprehensive Medical-Legal Solutions
          </h2>
          <p className="text-center text-gray-600 mb-16 max-w-3xl mx-auto text-sm">
            Every case includes our 4 key deliverables that provide more value than traditional medical record review
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {deliverables.map((item, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg p-8 text-center hover:shadow-md transition-shadow">
                <div className="flex justify-center mb-4">
                  <I name={item.icon} size={48} className="text-blue-600" />
                </div>
                <h3 className="font-bold text-lg mb-3 text-gray-900">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-4">Our Services</h2>
          <p className="text-center text-gray-600 mb-8">
            Get started with our AI-powered medical-legal analysis platform
          </p>
          
          {/* Register CTA */}
          <div className="text-center mb-10">
            <button
              onClick={() => navigate('/register')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
            >
              Register Now - Start Your Free Trial
            </button>
            <p className="text-sm text-gray-500 mt-2">No credit card required • HIPAA compliant • Expert validated</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 justify-items-center">
            {services.map((service, i) => {
              const isQuickProjection = service.name === 'Quick Cost Projection';
              const isLifeCarePlan = service.name === 'Life Care Plan';
              const isMedicalCostProjection = service.name === 'Medical Cost Projection';

              const clickableProps = (isQuickProjection || isLifeCarePlan || isMedicalCostProjection) ? {
                role: 'button',
                tabIndex: 0,
                onClick: () => handleServiceClick(service.name),
                onKeyDown: (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleServiceClick(service.name);
                  }
                },
              } : {};

              return (
                <div 
                  key={i}
                  className={`max-w-[210px] w-full min-h-[250px] flex flex-col justify-between border border-gray-300 rounded-lg p-4 text-center transition-all hover:shadow-lg hover:border-blue-500 hover:border-2 hover:bg-blue-50 hover:scale-[1.03] ${(isQuickProjection || isLifeCarePlan || isMedicalCostProjection) ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500' : ''}`}
                  {...clickableProps}
                >
                  <div>
                    <div className="text-5xl mb-3">{service.emoji}</div>
                    <h3 className="font-semibold text-md mb-1">{service.name}</h3>
                    <p className="text-xs text-gray-600 mb-1">Estimated: {service.time}</p>
                    <p className="text-xs text-gray-500">{service.payment}</p>
                  </div>

                  <Link 
                    to="/services" 
                    className="text-blue-600 font-semibold text-sm hover:text-blue-700 mt-3 inline-block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Learn More →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">What Our Clients Say</h2>
            <p className="text-gray-600">Join hundreds of medical-legal professionals who trust MedXprts</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <I name="user" size={24} className="text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold">Dr. Sarah Johnson</h4>
                <p className="text-sm text-gray-600">Medical Expert Witness</p>
              </div>
            </div>
            <p className="text-gray-700 italic">
              "MedXprts has cut my case preparation time by 70%. The AI-powered cost projections are incredibly accurate and the platform's security gives me confidence when handling sensitive medical data."
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-4">Transform Your Medical-Legal Workflows</h2>
          <p className="text-xl mb-8 text-blue-100">
            Join medical-legal professionals using secure, HIPAA-aligned AI infrastructure to enhance expert judgment
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-white text-blue-600 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Request Demo
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="px-8 py-4 border-2 border-white text-white rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Contact Sales
            </button>
          </div>
          <p className="mt-6 text-sm text-blue-100">
            Secure infrastructure • Expert validation • Professional compliance
          </p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;