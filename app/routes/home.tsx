import { ArrowRight, Clock, Layers } from "lucide-react";
import Navbar from "../../components/Navbar";
import type { Route } from "./+types/home";
import Button from "../../components/ui/Button";
import Upload from "../../components/Upload";
import { useNavigate } from "react-router";
import { useState } from "react";
import { createProject } from "../../lib/puter.action";

/**
 * Provide metadata for the home route.
 *
 * @returns An array of meta entries: one setting the page `title` to "HABIB-IVisualizer", and one setting the `description` content to "Welcome to HABIBI-Visualizer!".
 */
export function meta({ }: Route.MetaArgs) {
  return [
    { title: "HABIB-IVisualizer" },
    { name: "description", content: "Welcome to HABIBI-Visualizer!" },
  ];
}

/**
 * Render the HABIBI-Visualizer home page and manage project uploads.
 *
 * Initializes navigation and a local `projects` state array. Provides an upload handler that
 * creates a new project from a base64 floor-plan image, prepends it to local state, and
 * navigates to the visualizer route with the project's initial image data.
 *
 * @returns The React element for the home route (landing page).
 */
export default function Home() {
    const navigate = useNavigate();
    const [projects, setprojects] = useState<DesignItem[]>([]); 

    const handleUploadComplete = async (base64Image: string) => {
      const newId = Date.now().toString();
      const name = `Residence ${newId}`;

      const newItem = {
        id: newId, name, sourceImage: base64Image,
        renderedImage: undefined,
        timestamp: Date.now()
      }

      const saved = await createProject({ item: newItem, visibility: 'private'});

      if (!saved) {
        console.error("Failed to create project");
        return false;
      }

      setprojects((prev) => [newItem, ...prev]);

      navigate(`/visualizer/${newId}`, {
                state: {
                    initialImage: saved.sourceImage,
                    initialRendered: saved.renderedImage || null,
                    name
                }
            });

      return true;
    }

  return (
    <div className="home">
      <Navbar />
      <section className="hero">
        <div className="announce">
          <div className="dot">
            <div className="pulse"></div>
          </div>
          <p>Introducing HABIBI-Visualizer 2.0</p>
        </div>

        <h1>ANO TARA? SEND MO FLOOR PLAN MO</h1>
        <p className="subtitle">
          Roomify is an AI-first design environment that help you visualize, render, and ship
          architectural projects faster than ever
        </p>

        <div className="actions">
          <a href="#upload" className="cta">
            Start Building <ArrowRight className="icon" />
          </a>

          <Button variant="outline" size="lg" className="demo">
            Watch Demo
          </Button>
        </div>

        <div id="upload" className="upload-shell">
          <div className="grid-overlay" />

          <div className="upload-card">
            <div className="upload-head">

              <div className="upload-icon">
                <Layers className="icon" />
              </div>

              <h3>Upload your floor plan</h3>
              <p>Support JPG, PNG, formats up to 10MB</p>
            </div>
            <Upload onComplete={handleUploadComplete} /> 
          </div>
        </div>
      </section>

      <section className="projects">
        <div className="section-inner">
          <div className="section-head">
            <div className="copy">
              <h2>Projects</h2>
              <p>Your latest work and shared community projects, all in one place.</p>
            </div>
          </div>

          <div className="projects-grid">
            {projects.map(({id, name, renderedImage, sourceImage, timestamp}) => (
              <div className="project-card group">
                <div className="preview">
                  <img
                    src={renderedImage || sourceImage}
                    alt="Project"
                  />

                  <div className="badge">
                    <span>Community</span>
                  </div>
                </div>

                <div className="card-body">
                  <div>
                    <h3>{name}</h3>

                    <div className="meta">
                      <Clock size={12} />
                      <span>{new Date(timestamp).toLocaleDateString()}</span>
                      <span>By Habib Mangoranda</span>
                    </div>
                  </div>
                  <div className="arrow">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </div>
              
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
