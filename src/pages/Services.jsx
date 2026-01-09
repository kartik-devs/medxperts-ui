import React from 'react';
import { Link } from 'react-router-dom';

const Services = () => {
  const services = [
    {
      name: 'Quick Cost Projection',
      time: 'Estimated: < 60 Minutes',
      pricing: 'Pay-as-you-go available',
      href: '/services/quick-projection',
      description: 'Get a rapid estimate of medical costs for your case with our AI-powered quick projection service.',
      features: [
        'Quick turnaround time',
        'Cost-effective solution',
        'Ideal for initial case evaluation',
        'Basic medical cost estimation'
      ]
    },
    {
      name: 'Medical Record Review',
      time: 'Estimated: 3-5 days',
      pricing: 'Private pricing',
      href: '/services/medical-record-review',
      description: 'Comprehensive review of medical records with detailed analysis and summary.',
      features: [
        'Thorough record analysis',
        'Expert medical opinion',
        'Key findings summary',
        'Treatment recommendations'
      ]
    },
    {
      name: 'Medical Cost Projection',
      time: 'Estimated: 3-5 days',
      pricing: 'Private pricing',
      href: '/medicalcostprojection',
      description: 'Detailed projection of future medical costs including treatments and care needs.',
      features: [
        'Comprehensive cost analysis',
        'Future medical needs assessment',
        'Itemized cost breakdown',
        'Customized for case specifics'
      ]
    },
    {
      name: 'LCP Review',
      time: 'Estimated: 2-3 days',
      pricing: 'Private pricing',
      href: '/services/lcp-review',
      description: 'Expert review of Life Care Plans with detailed analysis and recommendations.',
      features: [
        'Thorough LCP evaluation',
        'Compliance verification',
        'Cost analysis',
        'Detailed report'
      ]
    },
    {
      name: 'Life Care Plan',
      time: 'Estimated: 5-7 days',
      pricing: 'Private pricing',
      href: '/services/life-care-plan',
      description: 'Comprehensive Life Care Plan development for long-term care needs.',
      features: [
        'Customized care plan',
        'Long-term care assessment',
        'Cost projections',
        'Treatment recommendations'
      ]
    }
  ];

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Our Services
          </h2>
          <p className="mt-4 text-xl text-gray-500">
            Comprehensive medical-legal solutions tailored to your needs
          </p>
        </div>

        <div className="mt-12">
          <div className="space-y-4">
            {services.map((service, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                      <svg
                        className="h-6 w-6 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                    </div>
                    <div className="ml-5 flex-1">
                      <h3 className="text-lg font-medium text-gray-900">{service.name}</h3>
                      <div className="mt-1 text-sm text-gray-500">
                        <p>{service.time} • {service.pricing}</p>
                      </div>
                    </div>
                    <div className="ml-5 flex-shrink-0">
                      <Link
                        to={service.href}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Learn More
                      </Link>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-gray-600">{service.description}</p>
                    <ul className="mt-2 space-y-1">
                      {service.features.map((feature, i) => (
                        <li key={i} className="flex items-start">
                          <svg
                            className="h-5 w-5 text-green-500"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="ml-2 text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <h3 className="text-lg font-medium text-gray-900">Need help choosing the right service?</h3>
          <p className="mt-2 text-gray-600">
            Our team is here to help you select the best solution for your needs.
          </p>
          <div className="mt-6">
            <Link
              to="/contact"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Services;
