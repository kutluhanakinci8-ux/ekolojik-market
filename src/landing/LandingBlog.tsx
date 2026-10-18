import { BLOG_POSTS } from '../data/landingContent';

export function LandingBlog() {
  return (
    <section className="landing-section">
      <div className="landing-section-head">
        <h2>Blog</h2>
        <p>POS kullanımı, stok yönetimi ve işletme ipuçları.</p>
      </div>
      <div className="landing-blog-grid">
        {BLOG_POSTS.map((post) => (
          <article key={post.id} className="landing-blog-card">
            <div className="landing-blog-card-body">
              <div className="landing-blog-meta">
                <span className="landing-blog-category">{post.category}</span>
                <span>{post.date}</span>
                <span>{post.readMin} dk okuma</span>
              </div>
              <h3>{post.title}</h3>
              <p>{post.excerpt}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
