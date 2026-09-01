import SideBar from '../components/SideBar';
import ChatArea from '../components/ChatArea';
import Artifact from '../components/Artifact';

// Only mounted when authenticated — App gates it — so there is no signed-out
// branch here any more.
function Home() {
    return (
        <div className='h-screen  flex bg-[#0d0f14] text-white overflow-hidden'>

<SideBar/>
<ChatArea/>
<Artifact/>

        </div>
    )
}

export default Home
