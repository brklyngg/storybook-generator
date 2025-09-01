# AI Children's Picture Book Generator

Transform any story into a beautifully illustrated children's picture book using Google Gemini 2.0 Flash AI. This web application takes text input (PDF, EPUB, or raw text) and generates age-appropriate children's book versions with AI-generated illustrations and intricate beautiful backgrounds.

## ✨ Features

- **Multi-format Support**: Upload PDF, EPUB, or TXT files, or paste text directly
- **Age-Appropriate Content**: Customize for ages 3-5, 6-8, or 9-12
- **Content Control**: Intensity slider from gentle (0) to adventurous (10)
- **Custom Art Style**: Define visual aesthetics with intricate beautiful backgrounds
- **Character Consistency**: Maintain character appearance across all pages
- **Interactive Editor**: Drag-and-drop page reordering, caption editing, image regeneration
- **Multiple Export Options**: PDF and ZIP downloads with manifest files
- **Safety Features**: Copyright detection and content filtering

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/brklyngg/storybook-generator.git
   cd storybook-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your Google Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🎯 Usage

### Basic Workflow

1. **Upload or Paste Story**: Choose a text file or paste content directly
2. **Configure Settings**: 
   - Select target age group (3-5, 6-8, 9-12)
   - Set content intensity level (0-10)
   - Define visual art style with intricate beautiful backgrounds
   - Add any specific notes or requests
   - Choose desired page count (10-30)
   - Enable/disable character consistency
3. **Generate Book**: Click "Create Picture Book" to start AI generation
4. **Edit & Customize**: Use the studio interface to reorder pages, edit captions, or regenerate images
5. **Export**: Download as PDF or ZIP file with all assets

### Example Settings

For "The Time Machine" by H.G. Wells:
- **Age**: 6-8 years
- **Intensity**: 3/10 (gentle adventure)
- **Style**: "warm watercolor, soft edges, gentle steampunk motifs, intricate beautiful backgrounds"
- **Result**: 20-page children's version with consistent character in tan coat & goggles

## 🏗️ Architecture

```
Upload/Parse → Scene Extraction → Age-Appropriate Summarization 
     ↓
Page Scripts → Character Sheets → Image Generation (Gemini)
     ↓
Storyboard UI → Export (PDF/ZIP)
```

### Key Components

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, shadcn/ui
- **AI Generation**: Google Gemini 2.0 Flash for text and image processing
- **File Processing**: PDF (unpdf), EPUB (@gxl/epub-parser), TXT support
- **Storage**: IndexedDB/localStorage for session persistence
- **Export**: PDF (pdf-lib), ZIP (jszip) with manifest files

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── parse/         # File parsing
│   │   ├── plan/          # Story planning
│   │   ├── generate/      # Image generation
│   │   └── export/        # PDF/ZIP export
│   ├── studio/            # Story editing interface
│   └── page.tsx           # Main upload page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── Controls.tsx      # Settings panel
│   ├── Storyboard.tsx    # Page grid view
│   ├── PageCard.tsx      # Individual page editor
│   └── ExportBar.tsx     # Download options
└── lib/                  # Utility libraries
    ├── gemini.ts         # AI integration
    ├── text.ts           # File parsing
    ├── prompting.ts      # AI prompt generation
    ├── safety.ts         # Content filtering
    ├── storage.ts        # Data persistence
    └── types.ts          # TypeScript definitions
```

## 🔧 API Reference

### POST /api/parse
Parse uploaded files (PDF, EPUB, TXT)

### POST /api/plan
Generate story structure and page breakdown

### POST /api/generate
Create AI illustrations for individual pages

### POST /api/export/pdf
Export complete book as PDF

### POST /api/export/zip
Export as ZIP with assets and manifest

## 💰 Cost Estimation

**Per 20-page book generation:**
- Gemini 2.0 Flash text processing: ~$0.02
- Gemini Image generation: 20 images × $0.039 = ~$0.78
- **Total per book**: ~$0.80

**Monthly estimates:**
- Free tier: 500 images = ~25 books
- Paid tier: Cost-effective for commercial use

## 🛡️ Safety & Ethics

- **Copyright Detection**: Automated checks for protected content
- **Content Filtering**: Age-appropriate content validation
- **AI Transparency**: Clear "AI-generated" labeling
- **Privacy**: Local storage with no data collection
- **Safety Guidelines**: Strict content policies for children's material

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add `GEMINI_API_KEY` to environment variables
3. Deploy automatically on push

### Other Platforms
- **Netlify**: Supports Next.js with serverless functions
- **Railway**: Full-stack deployment with databases
- **Self-hosted**: Docker support available

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Gemini AI for image and text generation
- Next.js team for the excellent framework
- shadcn/ui for beautiful component library
- All contributors and testers

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/brklyngg/storybook-generator/issues)
- **Documentation**: [Wiki](https://github.com/brklyngg/storybook-generator/wiki)

---

Built with ❤️ using Google Gemini AI and Next.js