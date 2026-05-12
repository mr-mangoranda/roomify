import { Box } from "lucide-react"
import Button from "./ui/Button";

const Navbar = () => {
    
    const isSignedIn = false;
    const username = 'habib';

    const handleAuthClick = async () => {}
    return (
            <header className="navbar">
                <nav className="inner">

                    {/* LEFT */}
                    <div className="left">
                        <div className="brand">
                            <Box className="logo" />

                            <span className="name">
                                Roomify
                            </span>
                        </div>
                        <ul className="links">
                            <a href="#">Product</a>
                            <a href="#">Pricing</a>
                            <a href="#">Community</a>
                            <a href="#">Enterprise</a>
                        </ul>
                    </div>

                    {/* RIGHT */}
                    <div className="actions">
                        {isSignedIn ? (
                            <>
                                <span className="greeting">
                                    {username ? `Hi, ${username}` : `Signed in`}
                                </span>
                                
                                <Button size="sm" onClick={handleAuthClick} className="btn">
                                    Log Out
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button onClick={handleAuthClick} size="sm" variant="ghost">
                                    Log In
                                </Button>
                                <a href="#upload" className="cta">Get Statrted</a>
                            </>
                        )}
                    </div>

                </nav>
            </header>
    )
}

export default Navbar