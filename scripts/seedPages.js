const mongoose = require('mongoose');
const Page = require('../models/Page');

const initialPages = [
  {
    key: 'privacy-policy',
    title: 'Privacy Policy',
    content: `<section class="legal-section">
  <h2>Privacy Policy for Interplanetary Television (iTV)</h2>
  <p>
    At Interplanetary Television (iTV), accessible at interplanetary.tv, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by Interplanetary Television (iTV) and how we use it. If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us.
  </p>
  <p>
    This Privacy Policy applies only to our online activities and is valid for visitors to our website with regards to the information that they shared and/or collect in Interplanetary Television (iTV). This policy is not applicable to any information collected offline or via channels other than this website.
  </p>
</section>

<section class="legal-section">
  <h2>Information we collect</h2>
  <p>
    The personal information that you are asked to provide, and the reasons why you are asked to provide it, will be made clear to you at the point we ask you to provide your personal information.
  </p>
  <p>
    If you contact us directly, we may receive additional information about you such as your name, email address, phone number, the contents of the message and/or attachments you may send us, and any other information you may provide.
  </p>
  <p>
    When you register for an Account, we may ask for your contact information, including items such as name, company name, address, email address, and telephone number.
  </p>
</section>

<section class="legal-section">
  <h2>How we use your information</h2>
  <p>We use the information we collect in various ways, including to:</p>
  <ul>
    <li>Provide, operate, and maintain our website</li>
    <li>Improve, personalize, and expand our website</li>
    <li>Understand and analyze how you use our website</li>
    <li>Develop new products, services, features, and functionality</li>
    <li>Communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the website, and for marketing and promotional purposes</li>
    <li>Send you emails</li>
    <li>Find and prevent fraud</li>
  </ul>
</section>

<section class="legal-section">
  <h2>Log Files</h2>
  <p>
    Interplanetary Television (iTV) follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this and a part of hosting services’ analytics. The information collected by log files include internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users’ movement on the website, and gathering demographic information.
  </p>
</section>

<section class="legal-section">
  <h2>Cookies and Web Beacons</h2>
  <p>
    Like any other website, Interplanetary Television (iTV) uses ‘cookies’. These cookies are used to store information including visitors’ preferences, and the pages on the website that the visitor accessed or visited. The information is used to optimize the users’ experience by customizing our web page content based on visitors’ browser type and/or other information.
  </p>
</section>

<section class="legal-section">
  <h2>Advertising Partners Privacy Policies</h2>
  <p>
    You may consult this list to find the Privacy Policy for each of the advertising partners of Interplanetary Television (iTV).
  </p>
  <p>
    Third-party ad servers or ad networks uses technologies like cookies, JavaScript, or Web Beacons that appear in their respective advertisements and links that appear on Interplanetary Television (iTV), which are sent directly to users’ browser. They automatically receive your IP address when this occurs. These technologies are used to measure the effectiveness of their advertising campaigns and/or to personalize the advertising content that you see on websites that you visit. Note that Interplanetary Television (iTV) has no access to or control over these cookies that are used by third-party advertisers.
  </p>
</section>

<section class="legal-section">
  <h2>Third Party Privacy Policies</h2>
  <p>
    Interplanetary Television (iTV)’s Privacy Policy does not apply to other advertisers or websites. Thus, we are advising you to consult the respective Privacy Policies of these third-party ad servers for more detailed information. It may include their practices and instructions about how to opt-out of certain options.
  </p>
  <p>
    You can choose to disable cookies through your individual browser options. To know more detailed information about cookie management with specific web browsers, it can be found at the browsers’ respective websites.
  </p>
</section>

<section class="legal-section">
  <h2>CCPA Privacy Rights (Do Not Sell My Personal Information)</h2>
  <p>Under the CCPA, among other rights, California consumers have the right to:</p>
  <ul>
    <li>Request that a business that collects a consumer’s personal data disclose the categories and specific pieces of personal data that a business has collected about consumers.</li>
    <li>Request that a business delete any personal data about the consumer that a business has collected.</li>
    <li>Request that a business that sells a consumer’s personal data, not sell the consumer’s personal data.</li>
  </ul>
  <p>
    If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please contact us.
  </p>
</section>

<section class="legal-section">
  <h2>GDPR Data Protection Rights</h2>
  <p>We would like to make sure you are fully aware of all of your data protection rights. Every user is entitled to the following:</p>
  <ul>
    <li><strong>The right to access</strong> – You have the right to request copies of your personal data. We may charge you a small fee for this service.</li>
    <li><strong>The right to rectification</strong> – You have the right to request that we correct any information you believe is inaccurate. You also have the right to request that we complete the information you believe is incomplete.</li>
    <li><strong>The right to erasure</strong> – You have the right to request that we erase your personal data, under certain conditions.</li>
    <li><strong>The right to restrict processing</strong> – You have the right to request that we restrict the processing of your personal data, under certain conditions.</li>
    <li><strong>The right to object to processing</strong> – You have the right to object to our processing of your personal data, under certain conditions.</li>
    <li><strong>The right to data portability</strong> – You have the right to request that we transfer the data that we have collected to another organization, or directly to you, under certain conditions.</li>
  </ul>
  <p>
    If you make a request, we have one month to respond to you. If you would like to exercise any of these rights, please contact us.
  </p>
</section>

<section class="legal-section">
  <h2>Children’s Information</h2>
  <p>
    Another part of our priority is adding protection for children while using the internet. We encourage parents and guardians to observe, participate in, and/or monitor and guide their online activity.
  </p>
  <p>
    Interplanetary Television (iTV) does not knowingly collect any Personal Identifiable Information from children under the age of 16. If you think that your child provided this kind of information on our website, we strongly encourage you to contact us immediately and we will do our best efforts to promptly remove such information from our records.
  </p>
</section>

<section class="legal-section">
  <h2>Changes to This Privacy Policy</h2>
  <p>
    We may update our Privacy Policy from time to time. Thus, we advise you to review this page periodically for any changes. We will notify you of any changes by posting the new Privacy Policy on this page. These changes are effective immediately, after they are posted on this page.
  </p>
</section>

<section class="legal-section">
  <h2>Contact Us</h2>
  <p>
    Questions or suggestions about our Privacy Policy, do not hesitate to contact us by emailing: <strong>dpo@103.133.215.134</strong> or <strong>info@interplanetary.tv</strong>
  </p>
</section>

<section class="legal-section">
  <h2>About Us</h2>
  <p>
    Interplanetary Television (iTV), an Over-The-Top (OTT) Free Ad-supported Streaming Television (FAST) and Subscription Video-On-Demand (SVOD) news, educational and entertainment video service about science, tech and space; accessible via public internet. Interplanetary Television is owned by Frederic Eger, Owner & CEO.
  </p>
</section>`
  },
  {
    key: 'terms-of-use',
    title: 'Terms of Use & Service',
    content: `<section class="legal-section">
  <h2>Terms of Use and Service</h2>
  <p class="legal-notice">
    PLEASE READ THE FOLLOWING TERMS AND CONDITIONS OF USE CAREFULLY BEFORE USING THIS WEBSITE.
  </p>
  <p>
    The following terms of use (the “Terms of Use” or “Terms of Service”) contain the terms and conditions applicable to you and your access to and use of this website, Interplanetary Television (iTV), accessible at <a href="https://www.interplanetary.tv" target="_blank" rel="noopener noreferrer">https://www.interplanetary.tv</a>. Interplanetary Television is owned and operated by Frederic Eger, CEO, Owner & Publisher.
  </p>
  <p>
    All users of this site agree that access to and use of this site are subject to the following terms and conditions and other applicable law. If you do not agree to these terms and conditions, please do not use this site.
  </p>
  <p>
    This document comprises the entire agreement between site operator Frederic Eger and authorized user (“member”, “user” or “you”), superseding any prior agreements. Our business operating address is Slokas iela 146 – 5. Riga, LV-1069. Latvia. Frederic Eger – Interplanetary.tv – Bank details: Interplanetary.tv – IBAN: LV86HABA0551055119107 - BIC: HABALV22.
  </p>
</section>

<section class="legal-section">
  <h2>Copyrights & Copyrights Disclaimer</h2>
  <p>
    The entire content included in this site, including but not limited to text, graphics, photos, videos or code is licensed and copyrighted and licensed to Interplanetary Television. These copyright properties are the property of Interplanetary Television (iTV) or Interplanetary.tv for the duration of their licenses, that may be to perpetuity.
  </p>
</section>

<section class="legal-section">
  <h2>Trademarks</h2>
  <p>
    All trademarks, service marks and trade names of Interplanetary Television and site operator Frederic Eger used in the site are trademarks or registered trademarks of Interplanetary Television and site operator Frederic Eger.
  </p>
</section>`
  },
  {
    key: 'faq',
    title: 'Frequently Asked Questions',
    content: [
      {
        iconName: "Sparkles",
        iconColor: "#007aff",
        question: "What is Interplanetary.tv?",
        answer: "Interplanetary Television (iTV) is a premium streaming television service dedicated to space exploration, astronomy, planetary science, and science fiction. We offer a mix of Free Ad-Supported Streaming TV (FAST) channels and Subscription Video on Demand (SVOD) movies, series, and exclusive documentaries."
      },
      {
        iconName: "CreditCard",
        iconColor: "#30d158",
        question: "How do subscription plans work?",
        answer: "We offer both Monthly and Yearly subscription levels. Subscribing gives you instant access to premium space documentaries, movies, and series without any advertisements and in High Definition (HD). You can purchase a plan easily using Stripe payment gateway. Active plans can be cancelled anytime from your profile screen."
      },
      {
        iconName: "Play",
        iconColor: "#ff3b30",
        question: "Can I watch on multiple devices?",
        answer: "Yes! Your Interplanetary TV account can be logged in on multiple supported devices simultaneously, including our Web app (itv-web) and the Smart LG TV App (LGTV-ITV-APP), allowing you to experience high-quality playback on any screen."
      },
      {
        iconName: "Tv",
        iconColor: "#af52de",
        question: "What kind of content is available?",
        answer: "Our catalog is sorted into TV Shows, Movies, News Videos, Documentary Films, Documentary Series, and Science-Fiction. Content is curated to bring you the best educational and entertainment assets from across the galaxy."
      },
      {
        iconName: "Download",
        iconColor: "#ff9500",
        question: "How do I download my purchase itinerary?",
        answer: "After purchasing any membership plan, navigate to your Profile page and select the 'Purchases' tab. On your active purchase card, click the 'Download Itinerary' button. This generates a detailed text document containing your transaction ID, customer email, purchase date, and subscription benefits."
      },
      {
        iconName: "HelpCircle",
        iconColor: "#54c1fb",
        question: "How do I contact customer support?",
        answer: "We are always here to help! You can reach out directly via email at info@interplanetary.tv or call us at +37123112488. You can also find these details in the 'Contact Us' tab on your profile page."
      }
    ]
  },
  {
    key: 'contact',
    title: 'Contact Us',
    content: {
      email: 'info@interplanetary.tv',
      phone: '+37123112488',
      dpoEmail: 'dpo@103.133.215.134',
      subtitle: "We're here to help! Reach out via email or phone anytime."
    }
  },
  {
    key: 'footer',
    title: 'Footer Settings',
    content: {
      description: 'Interplanetary Television (iTV) is your portal for streaming TV shows, movies, news, and documentaries about space exploration, science, technology, and science fiction.',
      copyright: '© 2026 Interplanetary.tv | All Rights Reserved. Owned and operated by Frederic Eger, CEO.'
    }
  }
];

async function seedPages() {
  try {
    for (const pageData of initialPages) {
      const exists = await Page.findOne({ key: pageData.key });
      if (!exists) {
        const newPage = new Page(pageData);
        await newPage.save();
        console.log(`Seeded page/settings key: ${pageData.key}`);
      }
    }
    console.log('Static pages database check/seeding complete.');
  } catch (err) {
    console.error('Error seeding pages:', err);
  }
}

module.exports = seedPages;
